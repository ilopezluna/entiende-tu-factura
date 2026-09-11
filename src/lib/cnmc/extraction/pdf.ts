/**
 * Platform-agnostic PDF extraction.
 *
 * Holds the escalating fallback strategy used to find the CNMC URL inside an
 * invoice PDF. Everything platform-specific (how pdfjs is loaded, how a canvas
 * is allocated) is injected, so the same strategy runs in a browser and in Node.
 */

import {
  CanvasSurface,
  CreateCanvas,
  QrCodeResult,
  findUrlInText,
  hasMatchingQr,
  pickMatchingUrl,
  scanSurfaceFull,
  scanTileRegions,
} from './scan';

/** Render scale used on the fast path; enough for ~90% of invoices. */
const DEFAULT_SCALE = 3;
/** Progressively heavier scales tried only when the fast path finds nothing. */
const FALLBACK_SCALES = [5, 7];

/** The subset of a pdfjs document this module uses. */
export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<any>;
}

/** The subset of the pdfjs module this module uses. */
export interface PdfjsLike {
  getDocument(source: any): { promise: Promise<PdfDocumentLike> };
}

/** Everything a platform must provide to read a PDF. */
export interface PdfPlatform {
  pdfjs: PdfjsLike;
  createCanvas: CreateCanvas;
  /**
   * Extra options merged into the pdfjs `getDocument` call, for platform
   * specifics such as disabling the worker outside a browser.
   */
  documentOptions?: Record<string, unknown>;
}

/**
 * Open a PDF document from raw bytes.
 *
 * pdfjs takes ownership of the buffer it is handed and detaches it, so every
 * call gets its own copy. The fallback strategy opens the same document up to
 * three times, and without this the second attempt would see a detached buffer.
 */
const openDocument = (bytes: Uint8Array, platform: PdfPlatform): Promise<PdfDocumentLike> =>
  platform.pdfjs.getDocument({ data: bytes.slice(), ...platform.documentOptions }).promise;

/**
 * Render a PDF page onto a canvas and return the surface for scanning.
 */
export async function renderPageToCanvas(
  pdfDoc: PdfDocumentLike,
  pageNum: number,
  scale: number,
  createCanvas: CreateCanvas,
): Promise<CanvasSurface | null> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const surface = createCanvas(viewport.width, viewport.height);
  if (!surface) return null;

  await page.render({
    canvasContext: surface.ctx,
    viewport: viewport,
    canvas: surface.canvas,
  }).promise;

  return surface;
}

/**
 * Extract QR codes from PDF bytes.
 *
 * Uses an escalating fallback strategy to keep the common case fast:
 *   1. Fast pass: full-image scan at default scale (handles ~90% of invoices)
 *   2. Tile fallback: 3x3 overlapping tile scan at default scale
 *   3. Higher-scale fallback: full + tile scan at higher scales (5x, 7x)
 *
 * @param bytes - Raw PDF bytes
 * @param platform - pdfjs instance and canvas factory
 * @param urlPredicate - Optional predicate — continues escalating if no matching QR found
 * @returns Array of QR code results found in the PDF
 */
export async function extractQrFromPdf(
  bytes: Uint8Array,
  platform: PdfPlatform,
  urlPredicate?: (url: string) => boolean,
): Promise<QrCodeResult[]> {
  try {
    const pdfDoc = await openDocument(bytes, platform);
    const { createCanvas } = platform;
    const allResults: QrCodeResult[] = [];

    // --- Pass 1: Full-image scan at default scale (fast path) ---
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      try {
        const surface = await renderPageToCanvas(pdfDoc, pageNum, DEFAULT_SCALE, createCanvas);
        if (!surface) continue;

        allResults.push(...scanSurfaceFull(surface, pageNum));
      } catch (err) {
        console.warn(`QR full-scan failed page ${pageNum}:`, err);
      }
    }

    if (hasMatchingQr(allResults, urlPredicate)) {
      return allResults;
    }

    // --- Pass 2: Tile scan at default scale ---
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      try {
        const surface = await renderPageToCanvas(pdfDoc, pageNum, DEFAULT_SCALE, createCanvas);
        if (!surface) continue;

        allResults.push(
          ...scanTileRegions(surface.canvas, surface.width, surface.height, pageNum, createCanvas),
        );
      } catch (err) {
        console.warn(`QR tile-scan failed page ${pageNum}:`, err);
      }
    }

    if (hasMatchingQr(allResults, urlPredicate)) {
      return allResults;
    }

    // --- Pass 3: Higher scales (full + tile) ---
    for (const scale of FALLBACK_SCALES) {
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        try {
          const surface = await renderPageToCanvas(pdfDoc, pageNum, scale, createCanvas);
          if (!surface) continue;

          let results = scanSurfaceFull(surface, pageNum);
          if (results.length === 0) {
            results = scanTileRegions(
              surface.canvas,
              surface.width,
              surface.height,
              pageNum,
              createCanvas,
            );
          }
          allResults.push(...results);
        } catch (err) {
          console.warn(`QR scan failed page ${pageNum} at scale ${scale}:`, err);
        }
      }

      if (hasMatchingQr(allResults, urlPredicate)) {
        return allResults;
      }
    }

    return allResults;
  } catch (error) {
    throw new Error(
      `Failed to extract QR from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Extract the full text content of a PDF.
 */
export async function extractTextFromPdf(
  bytes: Uint8Array,
  platform: PdfPlatform,
): Promise<string> {
  try {
    const pdfDoc = await openDocument(bytes, platform);

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Concatenate all text items
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Extract URLs from the PDF's hyperlink annotations.
 */
export async function extractHyperlinksFromPdf(
  bytes: Uint8Array,
  platform: PdfPlatform,
): Promise<string[]> {
  try {
    const pdfDoc = await openDocument(bytes, platform);
    const urls: string[] = [];

    // Iterate through all pages
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const annotations = await page.getAnnotations();

      // Extract URLs from link annotations
      for (const annotation of annotations as any[]) {
        // Check if it's a link annotation with a URL
        if (annotation.subtype === 'Link' && annotation.url) {
          urls.push(annotation.url);
        }
        // Some PDFs store links in the 'dest' or 'action' property
        else if (annotation.subtype === 'Link' && annotation.action && annotation.action.url) {
          urls.push(annotation.action.url);
        }
      }
    }

    return urls;
  } catch (error) {
    throw new Error(
      `Failed to extract hyperlinks from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Find the CNMC URL in PDF bytes, trying QR codes, then hyperlink annotations,
 * then a regex over the text layer.
 */
export async function extractCnmcUrlFromPdfBytes(
  bytes: Uint8Array,
  platform: PdfPlatform,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  // First attempt: Try to extract from QR codes
  try {
    const qrResults = await extractQrFromPdf(bytes, platform, urlPredicate);
    const fromQr = pickMatchingUrl(qrResults, urlPredicate);
    if (fromQr) return fromQr;
  } catch (error) {
    console.warn('QR extraction failed:', error);
  }

  // Second attempt: Try to extract from PDF hyperlink annotations
  try {
    const hyperlinks = await extractHyperlinksFromPdf(bytes, platform);
    for (const url of hyperlinks) {
      if (urlPredicate(url)) {
        return url;
      }
    }
  } catch (error) {
    console.warn('Hyperlink extraction failed:', error);
  }

  // Third attempt: Try to extract from PDF text
  try {
    const text = await extractTextFromPdf(bytes, platform);
    const urlFromText = findUrlInText(text, urlPredicate);

    if (urlFromText) {
      return urlFromText;
    }
  } catch (error) {
    console.warn('Text extraction failed:', error);
  }

  throw new Error('Failed to extract data from the invoice');
}

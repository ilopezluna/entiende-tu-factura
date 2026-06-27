import jsQR from 'jsqr';

// Lazy load PDF.js library using a promise cache to prevent race conditions.
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Load pdfjs-dist lazily and configure its worker.
 *
 * The worker is resolved via Vite's `new URL(..., import.meta.url)` mechanism,
 * which emits the worker as a build asset served alongside the app. This site
 * does not target offline use, so no inline-blob worker fallback is needed.
 */
export async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');

      if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
      }

      return pdfjs;
    })();
  }
  return pdfjsLibPromise;
}

/**
 * QR Code extraction result
 */
interface QrCodeResult {
  data: string;
  page: number;
  location: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
}

/**
 * Decode QR code from raw ImageData using jsQR
 * @param imageData - The ImageData to scan
 * @param pageNumber - Page number for reference
 * @returns Array of decoded QR codes with location
 */
function decodeQrFromImageData(imageData: ImageData, pageNumber: number): QrCodeResult[] {
  const qrResults: QrCodeResult[] = [];

  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  if (code) {
    qrResults.push({
      data: code.data,
      page: pageNumber,
      location: {
        topLeft: code.location.topLeftCorner,
        topRight: code.location.topRightCorner,
        bottomLeft: code.location.bottomLeftCorner,
        bottomRight: code.location.bottomRightCorner,
      },
    });
  }

  return qrResults;
}

/**
 * Scan overlapping regions of an image for QR codes.
 * Divides the image into a grid of overlapping tiles to improve detection
 * of small QR codes that jsQR may miss on a full-page scan.
 * @param img - The loaded HTMLImageElement
 * @param pageNumber - Page number for reference
 * @returns Array of decoded QR codes with location
 */
function scanRegionsForQr(img: HTMLImageElement, pageNumber: number): QrCodeResult[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  // Use a 3x3 grid with 25% overlap for thorough coverage
  const cols = 3;
  const rows = 3;
  const overlap = 0.25;

  const tileW = Math.ceil(img.width / (cols - (cols - 1) * overlap));
  const tileH = Math.ceil(img.height / (rows - (rows - 1) * overlap));

  canvas.width = tileW;
  canvas.height = tileH;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = Math.floor(col * tileW * (1 - overlap));
      const sy = Math.floor(row * tileH * (1 - overlap));

      // Clamp source coordinates
      const sw = Math.min(tileW, img.width - sx);
      const sh = Math.min(tileH, img.height - sy);

      if (sw <= 0 || sh <= 0) continue;

      ctx.clearRect(0, 0, tileW, tileH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const results = decodeQrFromImageData(imageData, pageNumber);
      if (results.length > 0) {
        return results;
      }
    }
  }

  return [];
}

/**
 * Decode QR codes from a data URL image
 * @param dataUrl - Data URL of the image
 * @param pageNumber - Page number for reference
 * @returns Array of decoded QR codes with location
 */
async function decodeQrFromImage(dataUrl: string, pageNumber: number): Promise<QrCodeResult[]> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();

      img.onload = () => {
        // Create a canvas to extract image data
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // First attempt: full-image scan
        let qrResults = decodeQrFromImageData(imageData, pageNumber);

        // Second attempt: scan overlapping regions (helps with small QR codes)
        if (qrResults.length === 0) {
          qrResults = scanRegionsForQr(img, pageNumber);
        }

        resolve(qrResults);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = dataUrl;
    } catch (error) {
      reject(
        new Error(
          `QR decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  });
}

/**
 * Render a PDF page to canvas and return the canvas + context for scanning.
 */
async function renderPageToCanvas(
  pdfDoc: { getPage: (n: number) => Promise<any> },
  pageNum: number,
  scale: number,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  }).promise;

  return { canvas, ctx };
}

/**
 * Scan a rendered canvas for QR codes using full-image scan only.
 */
function scanFullImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  pageNum: number,
): QrCodeResult[] {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeQrFromImageData(imageData, pageNum);
}

/**
 * Scan a rendered canvas for QR codes using overlapping tile regions.
 * Helps detect small QR codes that jsQR misses on a full-page scan.
 */
function scanTileRegions(canvas: HTMLCanvasElement, pageNum: number): QrCodeResult[] {
  const cols = 3;
  const rows = 3;
  const overlap = 0.25;
  const tileW = Math.ceil(canvas.width / (cols - (cols - 1) * overlap));
  const tileH = Math.ceil(canvas.height / (rows - (rows - 1) * overlap));

  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileW;
  tileCanvas.height = tileH;
  const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
  if (!tileCtx) return [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = Math.floor(col * tileW * (1 - overlap));
      const sy = Math.floor(row * tileH * (1 - overlap));
      const sw = Math.min(tileW, canvas.width - sx);
      const sh = Math.min(tileH, canvas.height - sy);
      if (sw <= 0 || sh <= 0) continue;

      tileCtx.clearRect(0, 0, tileW, tileH);
      tileCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      const tileData = tileCtx.getImageData(0, 0, sw, sh);
      const results = decodeQrFromImageData(tileData, pageNum);
      if (results.length > 0) return results;
    }
  }

  return [];
}

/**
 * Check if any QR result matches the predicate, or if there's no predicate
 * just check if there are any results at all.
 */
function hasMatchingQr(results: QrCodeResult[], urlPredicate?: (url: string) => boolean): boolean {
  if (results.length === 0) return false;
  if (!urlPredicate) return true;
  return results.some((qr) => urlPredicate(qr.data));
}

/**
 * Extract QR codes from a PDF file in the browser.
 *
 * Uses an escalating fallback strategy to keep the common case fast:
 *   1. Fast pass: full-image scan at default scale (handles ~90% of invoices)
 *   2. Tile fallback: 3×3 overlapping tile scan at default scale
 *   3. Higher-scale fallback: full + tile scan at higher scales (5×, 7×)
 *
 * @param file - PDF file from user input
 * @param urlPredicate - Optional predicate — continues escalating if no matching QR found
 * @returns Array of QR code results found in the PDF
 */
async function extractQrFromPdf(
  file: File,
  urlPredicate?: (url: string) => boolean,
): Promise<QrCodeResult[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    const DEFAULT_SCALE = 3;
    const FALLBACK_SCALES = [5, 7];

    // --- Pass 1: Full-image scan at default scale (fast path) ---
    const allResults: QrCodeResult[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      try {
        const rendered = await renderPageToCanvas(pdfDoc, pageNum, DEFAULT_SCALE);
        if (!rendered) continue;

        const results = scanFullImage(rendered.canvas, rendered.ctx, pageNum);
        allResults.push(...results);
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
        const rendered = await renderPageToCanvas(pdfDoc, pageNum, DEFAULT_SCALE);
        if (!rendered) continue;

        const results = scanTileRegions(rendered.canvas, pageNum);
        allResults.push(...results);
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
          const rendered = await renderPageToCanvas(pdfDoc, pageNum, scale);
          if (!rendered) continue;

          let results = scanFullImage(rendered.canvas, rendered.ctx, pageNum);
          if (results.length === 0) {
            results = scanTileRegions(rendered.canvas, pageNum);
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
 * Extract text content from a PDF file using pdfjs-dist
 * @param file - PDF file from user input
 * @returns The full text content of the PDF
 */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const pdfjs = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

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
 * Extract hyperlinks from PDF annotations using PDF.js
 * @param file - PDF file from user input
 * @returns Array of URLs found in PDF hyperlink annotations
 */
async function extractHyperlinksFromPdf(file: File): Promise<string[]> {
  try {
    const pdfjs = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
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
 * Find URLs in text that match a given predicate
 * @param text - Text to search for URLs
 * @param urlPredicate - Function to validate if a URL is valid
 * @returns First URL that matches the predicate, or null if none found
 */
function findUrlInText(text: string, urlPredicate: (url: string) => boolean): string | null {
  // Regex to find URLs in text
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const matches = text.match(urlRegex);

  if (!matches) {
    return null;
  }

  // Find the first URL that matches the predicate
  for (const url of matches) {
    // Clean up the URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;!?]+$/, '');
    if (urlPredicate(cleanUrl)) {
      return cleanUrl;
    }
  }

  return null;
}

/**
 * Extract CNMC URL from an image file by scanning for QR codes
 * @param file - Image file from user input (png, jpg, jpeg, etc.)
 * @param urlPredicate - Function to validate if a URL is valid CNMC URL
 * @returns The CNMC URL found in the image
 */
export async function extractCnmcUrlFromImage(
  file: File,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  try {
    // Convert File to data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });

    // Decode QR code from the image
    const qrResults = await decodeQrFromImage(dataUrl, 1);

    if (qrResults.length > 0) {
      // Find a valid URL in QR codes
      for (const qr of qrResults) {
        if (urlPredicate(qr.data)) {
          return qr.data;
        }
      }
    }

    throw new Error('No valid CNMC URL found in the image');
  } catch (error) {
    throw new Error(
      `Failed to extract URL from image: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Extract CNMC URL from PDF using QR codes with fallback to hyperlink and text extraction
 * @param file - PDF file from user input
 * @param urlPredicate - Function to validate if a URL is valid CNMC URL
 * @returns The CNMC URL found in the PDF
 */
export async function extractCnmcUrlFromPdf(
  file: File,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  // First attempt: Try to extract from QR codes
  try {
    const qrResults = await extractQrFromPdf(file, urlPredicate);

    if (qrResults.length > 0) {
      // Find a valid URL in QR codes
      for (const qr of qrResults) {
        if (urlPredicate(qr.data)) {
          return qr.data;
        }
      }
    }
  } catch (error) {
    console.warn('QR extraction failed:', error);
  }

  // Second attempt: Try to extract from PDF hyperlink annotations
  try {
    const hyperlinks = await extractHyperlinksFromPdf(file);
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
    const text = await extractTextFromPdf(file);
    const urlFromText = findUrlInText(text, urlPredicate);

    if (urlFromText) {
      return urlFromText;
    }
  } catch (error) {
    console.warn('Text extraction failed:', error);
  }

  throw new Error('Failed to extract data from the invoice');
}

/**
 * Extract CNMC URL from a file (auto-detects PDF or image)
 * @param file - File from user input (PDF or image)
 * @param urlPredicate - Function to validate if a URL is valid CNMC URL
 * @returns The CNMC URL found in the file
 */
export async function extractCnmcUrl(
  file: File,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  // Check file type and route to appropriate handler
  const fileType = file.type.toLowerCase();

  // Handle PDF files
  if (fileType === 'application/pdf') {
    return extractCnmcUrlFromPdf(file, urlPredicate);
  }

  // Handle image files
  if (
    fileType === 'image/png' ||
    fileType === 'image/jpeg' ||
    fileType === 'image/jpg' ||
    fileType === 'image/webp' ||
    fileType === 'image/gif' ||
    fileType === 'image/bmp'
  ) {
    return extractCnmcUrlFromImage(file, urlPredicate);
  }

  // If type is unknown or empty, try to detect from file extension
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.pdf')) {
    return extractCnmcUrlFromPdf(file, urlPredicate);
  }
  if (
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.bmp')
  ) {
    return extractCnmcUrlFromImage(file, urlPredicate);
  }

  throw new Error(
    `Unsupported file type: ${fileType || 'unknown'}. Supported types: PDF, PNG, JPG, JPEG, WEBP, GIF, BMP`,
  );
}

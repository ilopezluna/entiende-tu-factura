/**
 * Browser adapter for CNMC QR extraction.
 *
 * The scanning and PDF strategies live in `./scan` and `./pdf`, which know
 * nothing about the DOM. This module supplies the browser specifics: canvas
 * allocation, image decoding via `Image`/`FileReader`, and the pdfjs worker.
 */

import { CanvasSurface } from './scan';
import { scanImageSource, pickMatchingUrl } from './scan';
import { PdfPlatform, extractCnmcUrlFromPdfBytes } from './pdf';
import { detectInvoiceFileKind, unsupportedFileTypeError } from './fileType';

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
 * Allocate a DOM canvas for scanning.
 *
 * `willReadFrequently` matters here: every surface we create exists to be read
 * back with getImageData.
 */
const createCanvas = (width: number, height: number): CanvasSurface | null => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  return { canvas, ctx, width, height };
};

const pdfPlatform = async (): Promise<PdfPlatform> => ({
  pdfjs: await loadPdfJs(),
  createCanvas,
});

/** Read a File into raw bytes. */
const readFileBytes = async (file: File): Promise<Uint8Array> =>
  new Uint8Array(await file.arrayBuffer());

/** Load a File into a decoded HTMLImageElement. */
const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

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
    const img = await loadImageElement(file);
    const qrResults = scanImageSource(img, img.width, img.height, 1, createCanvas);

    const url = pickMatchingUrl(qrResults, urlPredicate);
    if (url) return url;

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
  const bytes = await readFileBytes(file);
  return extractCnmcUrlFromPdfBytes(bytes, await pdfPlatform(), urlPredicate);
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
  const kind = detectInvoiceFileKind(file.type, file.name);

  if (kind === 'pdf') return extractCnmcUrlFromPdf(file, urlPredicate);
  if (kind === 'image') return extractCnmcUrlFromImage(file, urlPredicate);

  throw unsupportedFileTypeError(file.type);
}

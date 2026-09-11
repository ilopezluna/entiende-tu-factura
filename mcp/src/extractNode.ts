/**
 * Node adapter for CNMC QR extraction.
 *
 * The scanning and PDF strategies are shared with the web app; this module only
 * supplies the Node specifics: reading bytes from disk, allocating a native
 * canvas, and loading pdfjs without a worker.
 *
 * Everything here is local. No bytes leave the machine.
 */

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, sep } from 'node:path';

import { createCanvas as createNativeCanvas, loadImage } from '@napi-rs/canvas';

import {
  detectInvoiceFileKind,
  unsupportedFileTypeError,
} from '../../src/lib/cnmc/extraction/fileType';
import { extractCnmcUrlFromPdfBytes, type PdfPlatform } from '../../src/lib/cnmc/extraction/pdf';
import {
  pickMatchingUrl,
  scanImageSource,
  type CanvasSurface,
} from '../../src/lib/cnmc/extraction/scan';

/** Image formats @napi-rs/canvas can decode. Narrower than the web app's list. */
const DECODABLE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'];

/** Allocate a native canvas for scanning. */
const createCanvas = (width: number, height: number): CanvasSurface | null => {
  const canvas = createNativeCanvas(Math.ceil(width), Math.ceil(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  return {
    canvas,
    ctx: ctx as unknown as CanvasSurface['ctx'],
    width: canvas.width,
    height: canvas.height,
  };
};

/**
 * Filesystem path of the standard fonts bundled with pdfjs-dist.
 *
 * Resolved from the installed package rather than hard-coded, and deliberately a
 * plain path: outside a browser pdfjs reads these with fs, so a file:// URL fails
 * and a remote URL would break the promise that this server never goes online.
 */
const standardFontDataUrl = (): string => {
  const require = createRequire(import.meta.url);
  const pkg = require.resolve('pdfjs-dist/package.json');
  return join(dirname(pkg), 'standard_fonts') + sep;
};

let pdfPlatformPromise: Promise<PdfPlatform> | null = null;

/**
 * Load pdfjs for Node.
 *
 * The legacy build runs without the browser-oriented worker plumbing;
 * `isEvalSupported: false` and `useSystemFonts: false` keep it from reaching
 * outside the process, which matters because this server must stay offline.
 */
const pdfPlatform = (): Promise<PdfPlatform> => {
  if (!pdfPlatformPromise) {
    pdfPlatformPromise = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

      return {
        pdfjs: pdfjs as unknown as PdfPlatform['pdfjs'],
        createCanvas,
        documentOptions: {
          isEvalSupported: false,
          useSystemFonts: false,
          disableFontFace: true,
          // Point pdfjs at the fonts shipped inside the installed package, so it
          // renders text pages without reaching for a CDN.
          standardFontDataUrl: standardFontDataUrl(),
        },
      } satisfies PdfPlatform;
    })();
  }
  return pdfPlatformPromise;
};

/** Thrown when the file exists but this platform cannot decode that image format. */
export class UndecodableImageError extends Error {
  constructor(filePath: string) {
    super(
      `No se puede decodificar la imagen ${basename(filePath)}. ` +
        `Formatos admitidos aquí: PNG, JPG, JPEG, WEBP, AVIF y SVG. ` +
        `Convierte GIF o BMP a PNG, o usa el PDF original de la factura.`,
    );
    this.name = 'UndecodableImageError';
  }
}

/**
 * Find the CNMC comparator URL in an image file on disk.
 */
export async function extractCnmcUrlFromImageFile(
  filePath: string,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  const name = filePath.toLowerCase();
  if (!DECODABLE_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new UndecodableImageError(filePath);
  }

  const bytes = await readFile(filePath);
  const img = await loadImage(bytes);
  const qrResults = scanImageSource(img, img.width, img.height, 1, createCanvas);

  const url = pickMatchingUrl(qrResults, urlPredicate);
  if (url) return url;

  throw new Error('No se ha encontrado ningún QR de la CNMC en la imagen.');
}

/**
 * Find the CNMC comparator URL in a PDF file on disk.
 */
export async function extractCnmcUrlFromPdfFile(
  filePath: string,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  const bytes = await readFile(filePath);
  return extractCnmcUrlFromPdfBytes(new Uint8Array(bytes), await pdfPlatform(), urlPredicate);
}

/**
 * Find the CNMC comparator URL in an invoice file, auto-detecting PDF or image.
 */
export async function extractCnmcUrlFromFile(
  filePath: string,
  urlPredicate: (url: string) => boolean,
): Promise<string> {
  const kind = detectInvoiceFileKind('', filePath);

  if (kind === 'pdf') return extractCnmcUrlFromPdfFile(filePath, urlPredicate);
  if (kind === 'image') return extractCnmcUrlFromImageFile(filePath, urlPredicate);

  throw unsupportedFileTypeError('');
}

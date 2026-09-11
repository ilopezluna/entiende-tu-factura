/**
 * Platform-agnostic QR scanning.
 *
 * The scanning strategy (full-image pass, then a 3x3 overlapping tile pass) is
 * the valuable part of QR extraction and must behave identically wherever it
 * runs, so it lives here with no DOM references. Callers supply a `createCanvas`
 * function; a browser passes one backed by `document.createElement('canvas')`,
 * Node one backed by a native canvas library.
 */

import jsQR from 'jsqr';

import { sanitizeQrData } from './sanitize';

/** Tile grid used by the fallback pass. */
const TILE_COLS = 3;
const TILE_ROWS = 3;
const TILE_OVERLAP = 0.25;

/** The subset of ImageData that jsQR needs. */
export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Whatever the platform's `drawImage` accepts as a source: a decoded image or
 * another canvas. Opaque here — this module only passes it straight through.
 */
export type DrawableSource = unknown;

/** The subset of a 2D canvas context this module needs. */
export interface CanvasContextLike {
  clearRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: any, dx: number, dy: number): void;
  drawImage(
    image: any,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  getImageData(x: number, y: number, width: number, height: number): ImageDataLike;
}

/** A canvas plus its context, as returned by a platform's `createCanvas`. */
export interface CanvasSurface {
  /** The canvas itself, usable as a `drawImage` source. */
  canvas: DrawableSource;
  ctx: CanvasContextLike;
  width: number;
  height: number;
}

/**
 * Platform hook: allocate a canvas of the given size. Returning null means the
 * platform could not provide a 2D context, and scanning is skipped.
 */
export type CreateCanvas = (width: number, height: number) => CanvasSurface | null;

/**
 * QR Code extraction result
 */
export interface QrCodeResult {
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
export function decodeQrFromImageData(
  imageData: ImageDataLike,
  pageNumber: number,
): QrCodeResult[] {
  const qrResults: QrCodeResult[] = [];

  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  if (code) {
    qrResults.push({
      data: sanitizeQrData(code.data),
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
 * Scan an already-rendered surface for QR codes with a single full-image pass.
 */
export function scanSurfaceFull(surface: CanvasSurface, pageNumber: number): QrCodeResult[] {
  const imageData = surface.ctx.getImageData(0, 0, surface.width, surface.height);
  return decodeQrFromImageData(imageData, pageNumber);
}

/**
 * Scan overlapping regions of a drawable source for QR codes.
 *
 * Divides the source into a 3x3 grid of tiles overlapping by 25% to improve
 * detection of small QR codes that jsQR may miss on a full-image scan. Returns
 * as soon as a tile yields a result.
 */
export function scanTileRegions(
  source: DrawableSource,
  width: number,
  height: number,
  pageNumber: number,
  createCanvas: CreateCanvas,
): QrCodeResult[] {
  const tileW = Math.ceil(width / (TILE_COLS - (TILE_COLS - 1) * TILE_OVERLAP));
  const tileH = Math.ceil(height / (TILE_ROWS - (TILE_ROWS - 1) * TILE_OVERLAP));

  const tile = createCanvas(tileW, tileH);
  if (!tile) return [];

  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      const sx = Math.floor(col * tileW * (1 - TILE_OVERLAP));
      const sy = Math.floor(row * tileH * (1 - TILE_OVERLAP));

      // Clamp source coordinates
      const sw = Math.min(tileW, width - sx);
      const sh = Math.min(tileH, height - sy);

      if (sw <= 0 || sh <= 0) continue;

      tile.ctx.clearRect(0, 0, tileW, tileH);
      tile.ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

      const tileData = tile.ctx.getImageData(0, 0, sw, sh);
      const results = decodeQrFromImageData(tileData, pageNumber);
      if (results.length > 0) return results;
    }
  }

  return [];
}

/**
 * Scan a decoded image for QR codes: a full-image pass first, then the tile
 * fallback. Used for image uploads, where nothing has been rendered yet.
 */
export function scanImageSource(
  source: DrawableSource,
  width: number,
  height: number,
  pageNumber: number,
  createCanvas: CreateCanvas,
): QrCodeResult[] {
  const surface = createCanvas(width, height);
  if (!surface) return [];

  surface.ctx.drawImage(source, 0, 0);

  // First attempt: full-image scan
  const qrResults = scanSurfaceFull(surface, pageNumber);
  if (qrResults.length > 0) return qrResults;

  // Second attempt: scan overlapping regions (helps with small QR codes)
  return scanTileRegions(source, width, height, pageNumber, createCanvas);
}

/**
 * Check if any QR result matches the predicate, or if there's no predicate
 * just check if there are any results at all.
 */
export function hasMatchingQr(
  results: QrCodeResult[],
  urlPredicate?: (url: string) => boolean,
): boolean {
  if (results.length === 0) return false;
  if (!urlPredicate) return true;
  return results.some((qr) => urlPredicate(qr.data));
}

/**
 * First QR payload matching the predicate, or null if none does.
 */
export function pickMatchingUrl(
  results: QrCodeResult[],
  urlPredicate: (url: string) => boolean,
): string | null {
  for (const qr of results) {
    if (urlPredicate(qr.data)) {
      return qr.data;
    }
  }
  return null;
}

/**
 * Find URLs in text that match a given predicate
 * @param text - Text to search for URLs
 * @param urlPredicate - Function to validate if a URL is valid
 * @returns First URL that matches the predicate, or null if none found
 */
export function findUrlInText(text: string, urlPredicate: (url: string) => boolean): string | null {
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

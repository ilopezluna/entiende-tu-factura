/**
 * Pure QR payload sanitisation.
 *
 * Kept apart from the extractor so that non-browser consumers (Node, tests) can
 * use it without pulling in pdfjs-dist or canvas.
 */

/**
 * Some invoice generators encode the QR payload as UTF-8 with a byte-order mark, which jsQR
 * surfaces as leading U+FEFF characters. `new URL()` rejects those, so an otherwise perfectly
 * readable QR would be treated as unreadable by every downstream consumer. Strip BOM and
 * surrounding whitespace at the one point where jsQR output enters the system.
 */
export function sanitizeQrData(data: string): string {
  return data.replace(/^[\uFEFF\u200B\s]+|[\uFEFF\u200B\s]+$/g, '');
}

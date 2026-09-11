/**
 * Invoice file type detection, shared by every platform adapter.
 */

export type InvoiceFileKind = 'pdf' | 'image';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
];

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

/** Human-readable list used in error messages. */
export const SUPPORTED_TYPES_LABEL = 'PDF, PNG, JPG, JPEG, WEBP, GIF, BMP';

/**
 * Decide whether a file is a PDF or an image, preferring the MIME type and
 * falling back to the file extension when the type is unknown or empty.
 *
 * @returns The detected kind, or null when the file is not supported.
 */
export function detectInvoiceFileKind(mimeType: string, fileName: string): InvoiceFileKind | null {
  const type = mimeType.toLowerCase();

  if (type === 'application/pdf') return 'pdf';
  if (SUPPORTED_IMAGE_MIME_TYPES.includes(type)) return 'image';

  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (SUPPORTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'image';

  return null;
}

/** Error thrown for a file that is neither a PDF nor a supported image. */
export function unsupportedFileTypeError(mimeType: string): Error {
  return new Error(
    `Unsupported file type: ${mimeType || 'unknown'}. Supported types: ${SUPPORTED_TYPES_LABEL}`,
  );
}

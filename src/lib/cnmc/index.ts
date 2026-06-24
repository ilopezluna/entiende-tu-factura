/**
 * CNMC core: extraction, parsing, validation and cost calculations for Spanish
 * electricity invoices (CNMC QR comparator data).
 *
 * Browser-safe surface: types, validators, parsing and cost calculations.
 * For the browser-only PDF/image extractor, import from './extraction' directly
 * (it pulls in pdfjs-dist and canvas).
 */

export * from './types';
export * from './extraction/validator';
export * from './parsing';
export * from './utils';

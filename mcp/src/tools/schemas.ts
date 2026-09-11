/**
 * Zod schemas for the tool inputs.
 *
 * Every analysis tool accepts the same three input shapes, so the shared parts
 * are defined once here.
 */

import { z } from 'zod';

export const invoiceInputShape = {
  file_path: z
    .string()
    .optional()
    .describe(
      'Absolute path to the invoice file on this machine (PDF, PNG, JPG, WEBP). The file is read ' +
        'locally and never uploaded anywhere.',
    ),
  qr_url: z
    .string()
    .optional()
    .describe(
      'An already-decoded CNMC comparator URL (https://comparador.cnmc.gob.es/comparador/QRE?...). ' +
        'Use this when the QR has been read elsewhere.',
    ),
  invoice: z
    .record(z.unknown())
    .optional()
    .describe(
      'The `invoice` object returned by a previous read_invoice call. Pass this to analyse the same ' +
        'invoice again without re-reading the file, which is much faster.',
    ),
};

export const invoiceInputSchema = z.object(invoiceInputShape);

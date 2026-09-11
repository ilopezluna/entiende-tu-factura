/**
 * Resolves the three ways an agent can hand over an invoice.
 *
 * Accepting a previously parsed `invoice` object matters: it lets an agent read
 * a file once and then call the analysis tools repeatedly without re-decoding
 * the PDF, which is by far the slowest step.
 */

import { isAbsolute, resolve } from 'node:path';

import { isCNMCUrl, parseQrParameters, type QrParameters } from '../../src/lib/cnmc';

import { extractCnmcUrlFromFile } from './extractNode';

export interface InvoiceInput {
  file_path?: string;
  qr_url?: string;
  invoice?: QrParameters;
}

/** Where the data came from, echoed back so the agent can tell them apart. */
export interface InvoiceSource {
  type: 'file' | 'qr_url' | 'invoice';
  file_path?: string;
  qr_url?: string;
}

export interface ResolvedInvoice {
  qrParams: QrParameters;
  source: InvoiceSource;
}

export class InvoiceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceInputError';
  }
}

const MISSING_INPUT =
  'Indica una factura: file_path (ruta a un PDF o imagen), qr_url (la URL del comparador de la ' +
  'CNMC ya decodificada) o invoice (los parámetros devueltos por read_invoice).';

/**
 * Turn any accepted input into parsed QR parameters.
 *
 * File reading happens entirely on this machine; nothing is uploaded anywhere.
 */
export async function resolveInvoice(input: InvoiceInput): Promise<ResolvedInvoice> {
  if (input.invoice) {
    return { qrParams: input.invoice, source: { type: 'invoice' } };
  }

  if (input.qr_url) {
    const url = input.qr_url.trim();
    if (!isCNMCUrl(url)) {
      throw new InvoiceInputError(
        'La URL no es un QR del comparador de la CNMC. Debe empezar por ' +
          'https://comparador.cnmc.gob.es/comparador/QRE',
      );
    }
    return { qrParams: parseQrParameters(url), source: { type: 'qr_url', qr_url: url } };
  }

  if (input.file_path) {
    const path = isAbsolute(input.file_path) ? input.file_path : resolve(input.file_path);
    const url = await extractCnmcUrlFromFile(path, isCNMCUrl);
    return {
      qrParams: parseQrParameters(url),
      source: { type: 'file', file_path: path, qr_url: url },
    };
  }

  throw new InvoiceInputError(MISSING_INPUT);
}

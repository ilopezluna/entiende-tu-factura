import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import QRCode from 'qrcode';

import { parseQrParameters } from '../../../src/lib/cnmc';
import { InvoiceInputError, resolveInvoice } from '../invoice';

const CNMC_URL =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=08001&pP1=4.6&pP2=4.6&pmaxP1=2.8&pmaxP2=3.1' +
  '&tc=E0&com=R2-760&cups=ES1234567890AZ&iniA=2025-08-31&caP1=1088&caP2=672&caP3=1222&impPot=20.84';

describe('resolveInvoice', () => {
  it('parses a QR URL handed over directly', async () => {
    const { qrParams, source } = await resolveInvoice({ qr_url: CNMC_URL });
    expect(qrParams.cups).toBe('ES1234567890AZ');
    expect(source).toEqual({ type: 'qr_url', qr_url: CNMC_URL });
  });

  it('tolerates surrounding whitespace on a pasted URL', async () => {
    const { qrParams } = await resolveInvoice({ qr_url: `  ${CNMC_URL}\n` });
    expect(qrParams.cp).toBe('08001');
  });

  it('rejects a URL that is not a CNMC comparator link', async () => {
    await expect(resolveInvoice({ qr_url: 'https://example.com/factura' })).rejects.toThrow(
      /comparador de la CNMC/,
    );
  });

  it('accepts already-parsed parameters without touching the disk', async () => {
    const invoice = parseQrParameters(CNMC_URL);
    const { qrParams, source } = await resolveInvoice({ invoice });
    expect(qrParams).toBe(invoice);
    expect(source).toEqual({ type: 'invoice' });
  });

  it('reads a file and reports the URL it found in it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'factura-luz-resolve-'));
    const pngPath = join(dir, 'factura.png');
    await QRCode.toFile(pngPath, CNMC_URL, { width: 600 });

    const { qrParams, source } = await resolveInvoice({ file_path: pngPath });
    expect(qrParams.cups).toBe('ES1234567890AZ');
    expect(source).toEqual({ type: 'file', file_path: pngPath, qr_url: CNMC_URL });
  });

  it('resolves a relative path against the working directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'factura-luz-resolve-'));
    const txtPath = join(dir, 'factura.txt');
    await writeFile(txtPath, 'no soy una factura');
    // Routing happens on the extension, so this proves the path was made absolute
    // before being handed on rather than failing as "not found".
    await expect(resolveInvoice({ file_path: txtPath })).rejects.toThrow(/Unsupported file type/);
  });

  it('explains what to pass when given nothing', async () => {
    await expect(resolveInvoice({})).rejects.toBeInstanceOf(InvoiceInputError);
    await expect(resolveInvoice({})).rejects.toThrow(/file_path/);
  });

  it('prefers parsed parameters over a file when both are given', async () => {
    const invoice = parseQrParameters(CNMC_URL);
    const { source } = await resolveInvoice({ invoice, file_path: '/no/existe.pdf' });
    expect(source.type).toBe('invoice');
  });
});

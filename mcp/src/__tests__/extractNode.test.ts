import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { isCNMCUrl } from '../../../src/lib/cnmc/extraction/validator';
import {
  extractCnmcUrlFromFile,
  extractCnmcUrlFromImageFile,
  extractCnmcUrlFromPdfFile,
  UndecodableImageError,
} from '../extractNode';

/**
 * A realistic but entirely synthetic CNMC payload. No real supply point is
 * referenced, so nothing here is personal data.
 */
const CNMC_URL =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=08001&pP1=4.6&pP2=4.6&pmaxP1=2.8&pmaxP2=3.1' +
  '&tc=E0&com=R2-760&cups=ES1234567890AZ&tf=N&iniF=2025-11-28&finF=2025-12-31&fFact=2026-01-04' +
  '&caP1=1088&caP2=672&caP3=1222&iniA=2025-08-31&imp=120.55&impPot=20.84&impEner=77.72' +
  '&prP1=0.10&prP2=0.05&prE1=0.119&prE2=0.120&prE3=0.119';

let dir: string;
let pngPath: string;
let pdfPath: string;
let smallQrPdfPath: string;
let blankPdfPath: string;
let textOnlyPdfPath: string;

/** Short payload for the text-layer fixture: a long one gets split across PDF text items. */
const SHORT_CNMC_URL =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=08001&pP1=4.6&pP2=4.6&tc=E0&impPot=20.84';

/** Build the fixtures at test time so no invoice is ever committed. */
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'factura-luz-mcp-'));

  pngPath = join(dir, 'invoice-qr.png');
  await QRCode.toFile(pngPath, CNMC_URL, { width: 600 });
  const qrBytes = await QRCode.toBuffer(CNMC_URL, { width: 600 });

  // A QR filling most of an A4 page: the fast full-page scan should find it.
  pdfPath = join(dir, 'invoice.pdf');
  {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const png = await pdf.embedPng(qrBytes);
    page.drawText('FACTURA DE ELECTRICIDAD', {
      x: 50,
      y: 780,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawImage(png, { x: 150, y: 300, width: 300, height: 300 });
    await writeFile(pdfPath, await pdf.save());
  }

  // A small QR low on the page, as real invoices print it: exercises the
  // escalating tile / higher-scale fallback.
  smallQrPdfPath = join(dir, 'invoice-small-qr.pdf');
  {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const png = await pdf.embedPng(qrBytes);
    page.drawText('FACTURA DE ELECTRICIDAD', {
      x: 50,
      y: 780,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText('Codigo QR informativo de la CNMC', { x: 50, y: 200, size: 9, font });
    page.drawImage(png, { x: 50, y: 90, width: 85, height: 85 });
    await writeFile(smallQrPdfPath, await pdf.save());
  }

  // No QR at all, but the CNMC URL sits in the text layer. Reaching it means
  // falling all the way through QR scanning and hyperlink annotations first, so
  // this also guards the document being re-opened three times from one buffer.
  textOnlyPdfPath = join(dir, 'solo-texto.pdf');
  {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('FACTURA DE ELECTRICIDAD', { x: 50, y: 780, size: 16, font });
    page.drawText(SHORT_CNMC_URL, { x: 40, y: 60, size: 7, font });
    await writeFile(textOnlyPdfPath, await pdf.save());
  }

  blankPdfPath = join(dir, 'sin-qr.pdf');
  {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('Esta factura no lleva QR', { x: 50, y: 700, size: 14, font });
    await writeFile(blankPdfPath, await pdf.save());
  }
});

describe('extractCnmcUrlFromImageFile', () => {
  it('reads the CNMC URL out of a PNG QR', async () => {
    await expect(extractCnmcUrlFromImageFile(pngPath, isCNMCUrl)).resolves.toBe(CNMC_URL);
  });

  it('rejects image formats this platform cannot decode', async () => {
    const bmpPath = join(dir, 'factura.bmp');
    await writeFile(bmpPath, Buffer.from([0x42, 0x4d, 0x00]));
    await expect(extractCnmcUrlFromImageFile(bmpPath, isCNMCUrl)).rejects.toBeInstanceOf(
      UndecodableImageError,
    );
  });
});

describe('extractCnmcUrlFromPdfFile', () => {
  it('reads the CNMC URL out of a large QR on the fast path', async () => {
    await expect(extractCnmcUrlFromPdfFile(pdfPath, isCNMCUrl)).resolves.toBe(CNMC_URL);
  });

  it('finds a small QR via the escalating fallback', async () => {
    await expect(extractCnmcUrlFromPdfFile(smallQrPdfPath, isCNMCUrl)).resolves.toBe(CNMC_URL);
  });

  it('falls back to the text layer when there is no readable QR', async () => {
    await expect(extractCnmcUrlFromPdfFile(textOnlyPdfPath, isCNMCUrl)).resolves.toBe(
      SHORT_CNMC_URL,
    );
  });

  it('fails clearly when the PDF carries no CNMC data at all', async () => {
    await expect(extractCnmcUrlFromPdfFile(blankPdfPath, isCNMCUrl)).rejects.toThrow(
      /Failed to extract data from the invoice/,
    );
  });
});

describe('extractCnmcUrlFromFile', () => {
  it('routes by extension to the PDF reader', async () => {
    await expect(extractCnmcUrlFromFile(pdfPath, isCNMCUrl)).resolves.toBe(CNMC_URL);
  });

  it('routes by extension to the image reader', async () => {
    await expect(extractCnmcUrlFromFile(pngPath, isCNMCUrl)).resolves.toBe(CNMC_URL);
  });

  it('rejects an unsupported file type', async () => {
    const txtPath = join(dir, 'factura.txt');
    await writeFile(txtPath, 'no soy una factura');
    await expect(extractCnmcUrlFromFile(txtPath, isCNMCUrl)).rejects.toThrow(
      /Unsupported file type/,
    );
  });
});

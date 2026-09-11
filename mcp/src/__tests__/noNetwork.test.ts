import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';

import QRCode from 'qrcode';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import { isCNMCUrl } from '../../../src/lib/cnmc/extraction/validator';
import { extractCnmcUrlFromPdfFile } from '../extractNode';
import { presentInvoice } from '../present';
import { parseQrParameters } from '../../../src/lib/cnmc';

/**
 * This package's whole reason for running locally is that the invoice never
 * leaves the machine. That is a promise about behaviour, so it gets a test:
 * every outbound primitive is replaced with one that fails loudly, and a full
 * read is then performed.
 */

const CNMC_URL =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=08001&pP1=4.6&pP2=4.6&pmaxP1=2.8&pmaxP2=3.1' +
  '&tc=E0&com=R2-760&cups=ES1234567890AZ&tf=N&iniF=2025-11-28&finF=2025-12-31&fFact=2026-01-04' +
  '&caP1=1088&caP2=672&caP3=1222&iniA=2025-08-31&imp=120.55&impPot=20.84&impEner=77.72' +
  '&prP1=0.10&prP2=0.05&prE1=0.119&prE2=0.120&prE3=0.119';

const attempts: string[] = [];
const originals = {
  fetch: globalThis.fetch,
  httpRequest: http.request,
  httpsRequest: https.request,
  netConnect: net.connect,
  dnsLookup: dns.lookup,
};

let pdfPath: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'factura-luz-offline-'));
  pdfPath = join(dir, 'invoice.pdf');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const png = await pdf.embedPng(await QRCode.toBuffer(CNMC_URL, { width: 600 }));
  page.drawText('FACTURA DE ELECTRICIDAD', { x: 50, y: 780, size: 16, font });
  page.drawImage(png, { x: 150, y: 300, width: 300, height: 300 });
  await writeFile(pdfPath, await pdf.save());

  const record = (what: string) => {
    attempts.push(what);
    throw new Error(`Se ha intentado salir a la red (${what}), y este servidor debe ser local.`);
  };

  globalThis.fetch = (() => record('fetch')) as typeof globalThis.fetch;
  http.request = (() => record('http.request')) as typeof http.request;
  https.request = (() => record('https.request')) as typeof https.request;
  net.connect = (() => record('net.connect')) as typeof net.connect;
  dns.lookup = (() => record('dns.lookup')) as unknown as typeof dns.lookup;
});

afterAll(() => {
  globalThis.fetch = originals.fetch;
  http.request = originals.httpRequest;
  https.request = originals.httpsRequest;
  net.connect = originals.netConnect;
  dns.lookup = originals.dnsLookup;
});

describe('the server stays offline', () => {
  it('reads a PDF invoice without touching the network', async () => {
    const url = await extractCnmcUrlFromPdfFile(pdfPath, isCNMCUrl);
    expect(url).toBe(CNMC_URL);
    expect(attempts).toEqual([]);
  });

  it('builds the full report without touching the network', async () => {
    const report = presentInvoice(parseQrParameters(CNMC_URL));
    expect(report.monthly_estimate.total_eur).toBe(136.95);
    expect(attempts).toEqual([]);
  });
});

import { sanitizeQrData, isCNMCUrl } from '../extraction';

const CNMC_QR =
  'https://comparador.cnmc.gob.es/comparador/QRE2?cp=00000&pP1=4.400&pP2=4.400&tc=E0&com=R2-000&cups=ES1234567890AZ0F&tf=N&iniF=2026-06-22&finF=2026-07-22&imp=72.78&rev=0';

// Some invoice generators emit the payload as UTF-8 with a byte-order mark, and
// jsQR surfaces those bytes as leading U+FEFF characters.
const BOM = '\uFEFF';

describe('sanitizeQrData', () => {
  test('strips a byte-order mark that would otherwise break URL parsing', () => {
    expect(sanitizeQrData(`${BOM}${CNMC_QR}`)).toBe(CNMC_QR);
  });

  test('strips repeated byte-order marks', () => {
    expect(sanitizeQrData(`${BOM}${BOM}${CNMC_QR}`)).toBe(CNMC_QR);
  });

  test('strips surrounding whitespace and zero-width spaces', () => {
    expect(sanitizeQrData(`  \n${CNMC_QR}\u200B `)).toBe(CNMC_QR);
  });

  test('leaves a clean payload untouched', () => {
    expect(sanitizeQrData(CNMC_QR)).toBe(CNMC_QR);
  });
});

describe('isCNMCUrl with BOM-prefixed payloads', () => {
  test('rejects a raw BOM-prefixed URL', () => {
    // `new URL()` throws on a leading U+FEFF, which is what made these invoices
    // fail extraction: a perfectly readable QR was rejected by the predicate.
    expect(isCNMCUrl(`${BOM}${BOM}${CNMC_QR}`)).toBe(false);
  });

  test('accepts the same URL once sanitized', () => {
    expect(isCNMCUrl(sanitizeQrData(`${BOM}${BOM}${CNMC_QR}`))).toBe(true);
  });
});

import { parseQrParameters } from '../parsing';
import { isCNMCUrl } from '../extraction';

const CNMC_QR =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=10.39&pP2=10.39&tc=F0&com=R2-760&cups=ES1234567890AZ&tf=N&iniF=2025-11-28&finF=2025-12-31&fFact=2026-01-04&caP1=1088&caP2=672&caP3=1222&iniA=2025-08-31&imp=281.55&cfP1=446&cfP2=313&cfP3=730&impPot=41.84&impEner=177.72&prP1=0.095000&prP2=0.027000&prE1=0.119000&prE2=0.120000&prE3=0.119000';

describe('parseQrParameters', () => {
  test('parses required string and numeric fields', () => {
    const p = parseQrParameters(CNMC_QR);
    expect(p.cp).toBe('00000');
    expect(p.cups).toBe('ES1234567890AZ');
    expect(p.com).toBe('R2-760');
    expect(p.tc).toBe('F0');
    expect(p.pP1).toBe(10.39);
    expect(p.pP2).toBe(10.39);
    expect(p.caP1).toBe(1088);
    expect(p.caP2).toBe(672);
    expect(p.caP3).toBe(1222);
    expect(p.impPot).toBe(41.84);
  });

  test('parses optional fields when present', () => {
    const p = parseQrParameters(CNMC_QR);
    expect(p.imp).toBe(281.55);
    expect(p.impEner).toBe(177.72);
    expect(p.prE1).toBe(0.119);
    expect(p.cfP1).toBe(446);
    expect(p.iniF).toBe('2025-11-28');
    expect(p.finF).toBe('2025-12-31');
    expect(p.fFact).toBe('2026-01-04');
  });

  test('omits optional fields that are absent', () => {
    const p = parseQrParameters(CNMC_QR);
    expect(p.dto).toBeUndefined();
    expect(p.exc).toBeUndefined();
    expect(p.finPen).toBeUndefined();
  });

  test('accepts the cfP1Flex / cfP2Flex casing alias', () => {
    const url = `${CNMC_QR}&cfP1Flex=12&cfP2Flex=34`;
    const p = parseQrParameters(url);
    expect(p.cfP1flex).toBe(12);
    expect(p.cfP2flex).toBe(34);
  });

  test('defaults required numeric fields to 0 on garbage input', () => {
    const url = 'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=abc';
    const p = parseQrParameters(url);
    expect(p.pP1).toBe(0);
    expect(p.caP1).toBe(0);
    expect(p.impPot).toBe(0);
  });

  test('throws on an invalid URL', () => {
    expect(() => parseQrParameters('not-a-url')).toThrow('Error parsing CNMC URL parameters');
  });
});

describe('URL validators', () => {
  test('isCNMCUrl matches only the CNMC comparator over https', () => {
    expect(isCNMCUrl(CNMC_QR)).toBe(true);
    expect(isCNMCUrl('http://comparador.cnmc.gob.es/comparador/QRE?x=1')).toBe(false);
    expect(isCNMCUrl('https://comparador.cnmc.gob.es/otro')).toBe(false);
    expect(isCNMCUrl('https://example.com/comparador/QRE')).toBe(false);
    expect(isCNMCUrl('garbage')).toBe(false);
  });
});

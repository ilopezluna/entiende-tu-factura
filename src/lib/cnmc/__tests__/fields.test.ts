import { describe, it, expect } from 'vitest';

import { QR_FIELDS } from '../content/fields';

/**
 * Pins the field dictionary against the norm it claims to transcribe.
 *
 * Resolución de la CNMC de 6 de octubre de 2022, Anexo I, Tabla 1:
 * https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-16989
 *
 * This exists because seven of these flags were wrong. The dictionary is the
 * only place an agent learns whether a missing field is normal, so a silent
 * drift from the norm is a defect that nothing else would catch.
 */

/**
 * The «Obligatorio» column of Table 1, transcribed row by row. `true` is a
 * ticked box, meaning present on every invoice. `false` covers both the
 * conditional rows ("siempre, salvo en facturas anuladoras…") and the genuinely
 * optional ones; Table 1 does not tick either.
 *
 * The row number is here so a reader can check any line against the PDF.
 */
const TABLE_1_MANDATORY: Record<string, [row: number, ticked: boolean]> = {
  cp: [1, true],
  pP1: [2, true],
  pP2: [3, true],
  caP1: [4, true],
  caP2: [5, true],
  caP3: [6, true],
  iniA: [7, true],
  tc: [8, true],
  finPen: [9, false],
  finContrato: [10, true],
  tf: [11, true],
  imp: [12, false],
  cfP1: [13, false],
  cfP2: [14, false],
  cfP3: [15, false],
  iniF: [16, true],
  finF: [17, true],
  impSA: [18, false],
  impOtrosConIE: [19, false],
  impOtrosSinIE: [20, false],
  exc: [21, false],
  com: [22, true],
  cups: [23, true],
  pmaxP1: [24, true],
  pmaxP2: [25, true],
  fFact: [26, true],
  dtoBS: [27, false],
  finBS: [28, false],
  ajuste: [29, false],
  impPot: [30, false],
  impEner: [31, false],
  dto: [32, false],
  prP1: [33, false],
  prP2: [34, false],
  prE1: [35, false],
  prE2: [36, false],
  prE3: [37, false],
  cfP1flex: [38, false],
  cfP2flex: [39, false],
  cambio: [40, false],
  promo: [41, false],
  verde: [42, false],
  rev: [43, true],
};

describe('QR_FIELDS against Annex I, Table 1', () => {
  it('documents the 43 parameters the norm defines, and no others', () => {
    expect(Object.keys(QR_FIELDS).sort()).toEqual(Object.keys(TABLE_1_MANDATORY).sort());
  });

  it.each(Object.entries(TABLE_1_MANDATORY))(
    'row %s: %s matches the Obligatorio column',
    (field, [, ticked]) => {
      expect(QR_FIELDS[field as keyof typeof QR_FIELDS].required).toBe(ticked);
    },
  );

  it('gives the power price the unit the norm states, not the one retailers use', () => {
    // Table 1 rows 33 and 34 both read «eur/kW año». Many retailers send €/kW día
    // anyway, which is why the note exists and why read_invoice has to deduce it.
    expect(QR_FIELDS.prP1.unit).toBe('€/kW año');
    expect(QR_FIELDS.prP2.unit).toBe('€/kW año');
    expect(QR_FIELDS.prP1.notes).toContain('€/kW día');
  });

  it('gives the energy price and the power amounts their units', () => {
    expect(QR_FIELDS.prE1.unit).toBe('€/kWh');
    expect(QR_FIELDS.pP1.unit).toBe('kW');
    expect(QR_FIELDS.pmaxP1.unit).toBe('kW');
    expect(QR_FIELDS.caP1.unit).toBe('kWh');
  });
});

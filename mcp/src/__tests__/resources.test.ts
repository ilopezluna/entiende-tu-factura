import { describe, it, expect } from 'vitest';

import {
  DAYS_PER_YEAR,
  ELECTRICITY_TAX_RATE,
  IVA_RATE,
  MIN_RECOMMENDED_POWER_KW,
  POWER_CHANGE_FEE_EUR,
  POWER_STEP_KW,
  SAFETY_MARGIN,
} from '../../../src/lib/cnmc';
import { parseQrParameters } from '../../../src/lib/cnmc';
import { presentInvoice } from '../present';
import { powerMethodResource, qrFieldsResource } from '../resources';

/**
 * The server stopped computing the power verdict and now publishes the method so
 * the calling agent can. That only holds up if two things stay true, and both are
 * asserted here.
 *
 * 1. The resource says exactly what the shared modules do. A constant changed in
 *    `powerAnalysis.ts` for the website must not leave the agent quoting the old
 *    one.
 * 2. The published method is *sufficient*: following it and nothing else lands on
 *    the same figures the website shows. The recipe is therefore re-implemented
 *    below from the resource's own steps, deliberately without calling
 *    `analyzePower` — calling it would prove nothing about what an agent reading
 *    the resource can work out.
 */

const method = powerMethodResource();

describe('powerMethodResource constants', () => {
  it('publishes the same constants the web app calculates with', () => {
    expect(method.constants).toEqual({
      safety_margin: SAFETY_MARGIN,
      power_step_kw: POWER_STEP_KW,
      min_recommended_power_kw: MIN_RECOMMENDED_POWER_KW,
      days_per_year: DAYS_PER_YEAR,
      change_fee_eur: POWER_CHANGE_FEE_EUR,
      electricity_tax_rate: ELECTRICITY_TAX_RATE,
      iva_rate: IVA_RATE,
    });
  });

  it('quotes the change fee consistently in the prose and the field', () => {
    expect(method.change_fee.amount_eur).toBe(POWER_CHANGE_FEE_EUR);
    expect(method.change_fee.description).toContain(String(POWER_CHANGE_FEE_EUR));
  });

  it('describes the four verdicts in evaluation order', () => {
    expect(method.verdict.states.map((s) => s.id)).toEqual([
      'no-data',
      'tight',
      'lower-possible',
      'keep',
    ]);
  });
});

/** Step 1 of `recommended_power`, applied literally as the resource words it. */
const recommendedKw = (maxDemandedKw: number, contractedKw: number): number => {
  const { safety_margin, power_step_kw, min_recommended_power_kw } = method.constants;
  const withMargin = maxDemandedKw * (1 + safety_margin);
  // "Redondea hacia ARRIBA a múltiplos de 0,1 kW", with an epsilon so float noise
  // does not push an exact multiple onto the next step.
  const steps = Math.ceil(withMargin / power_step_kw - 1e-9);
  const rounded = Math.round(steps * power_step_kw * 1e6) / 1e6;
  return Math.min(Math.max(rounded, min_recommended_power_kw), contractedKw);
};

/** The `annual_saving` cascade, applied literally as the resource words it. */
const annualSaving = (base: number) => {
  const { electricity_tax_rate, iva_rate } = method.constants;
  const electricityTax = base * electricity_tax_rate;
  const iva = (base + electricityTax) * iva_rate;
  return { base, electricityTax, iva, total: base + electricityTax + iva };
};

describe('powerMethodResource worked example', () => {
  const { given, expected } = method.worked_example;

  const p1 = recommendedKw(given.max_demanded_kw.p1, given.contracted_kw.p1);
  const p2 = recommendedKw(given.max_demanded_kw.p2, given.contracted_kw.p2);
  // "Redondeado a 1 decimal [...] y nunca negativo", as the resource words it.
  const freedKw = (contractedKw: number, recommended: number) =>
    Math.max(Math.round((contractedKw - recommended) * 10) / 10, 0);
  const freedP1 = freedKw(given.contracted_kw.p1, p1);
  const freedP2 = freedKw(given.contracted_kw.p2, p2);
  const baseP1 = freedP1 * given.power_eur_per_kw_day.p1 * method.constants.days_per_year;
  const baseP2 = freedP2 * given.power_eur_per_kw_day.p2 * method.constants.days_per_year;
  const saving = annualSaving(baseP1 + baseP2);

  it('rounds the recommendation up to a contractable step', () => {
    // 2,8 x 1,1 = 3,08 -> 3,1 and 3,1 x 1,1 = 3,41 -> 3,5, never 3,4.
    expect(p1).toBeCloseTo(expected.recommended_kw.p1, 6);
    expect(p2).toBeCloseTo(expected.recommended_kw.p2, 6);
  });

  it('frees the kW the example promises', () => {
    expect(freedP1).toBeCloseTo(expected.freed_kw.p1, 6);
    expect(freedP2).toBeCloseTo(expected.freed_kw.p2, 6);
  });

  it('reaches the annual saving the web app shows for this invoice', () => {
    expect(baseP1).toBeCloseTo(expected.annual_saving_base_eur.p1, 2);
    expect(baseP2).toBeCloseTo(expected.annual_saving_base_eur.p2, 2);
    expect(saving.base).toBeCloseTo(expected.base_eur, 2);
    expect(saving.total).toBeCloseTo(expected.total_eur, 2);
  });

  it('recovers the change fee in the stated number of months', () => {
    const payback = method.constants.change_fee_eur / (saving.total / 12);
    expect(payback).toBeCloseTo(expected.payback_months, 1);
  });

  it('lands on the lower-possible verdict', () => {
    const freed = freedP1 + freedP2;
    const tight =
      given.max_demanded_kw.p1 >= given.contracted_kw.p1 ||
      given.max_demanded_kw.p2 >= given.contracted_kw.p2;
    const verdict = tight
      ? 'tight'
      : freed >= method.constants.power_step_kw - 1e-9
        ? 'lower-possible'
        : 'keep';
    expect(verdict).toBe(expected.verdict);
  });
});

describe('qrFieldsResource', () => {
  const resource = qrFieldsResource();

  it('points at the norm it transcribes', () => {
    expect(resource.source_url).toBe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-16989');
    expect(resource.source).toContain('Anexo I');
  });

  it('says what a false required flag actually means', () => {
    // Seven of these flags were wrong before; a reader who takes false for
    // "optional" draws the wrong conclusion from a missing field.
    expect(resource.required_means).toContain('NO quiere decir opcional');
  });

  it('carries the five invoice types of Table 2', () => {
    expect(resource.invoice_types.types.map((t) => t.code)).toEqual(['A', 'N', 'R', 'C', 'G']);
    for (const type of resource.invoice_types.types) {
      expect(type.label).toBeTruthy();
      expect(type.explanation).toBeTruthy();
    }
  });

  it("publishes the annex's worked example with its defect flagged", () => {
    // The URL printed in the BOE lost the decimal separator of prP1 and prP2,
    // so it is published verbatim for reference and corrected for use.
    expect(resource.example.url_as_printed).toContain('prP1=26164043&prP2=1143132');
    expect(resource.example.url_corrected).toContain('prP1=26.164043&prP2=1.143132');
    expect(resource.example.known_defect).toContain('separador decimal');
  });

  it('parses the corrected example into the values Table 4 lists', () => {
    const parsed = parseQrParameters(resource.example.url_corrected);
    expect(parsed.cups).toBe('ES0000000002054081TS');
    expect(parsed.pP1).toBe(3.3);
    expect(parsed.pmaxP1).toBe(3.0);
    expect(parsed.imp).toBe(151.62);
    expect(parsed.prP1).toBe(26.164043);
    expect(parsed.prP2).toBe(1.143132);
    expect(parsed.prE1).toBe(0.263547);
  });

  it('reads the example as annual power prices, which is what the norm says', () => {
    // 26 €/kW is nonsense per day and right per year. The report says so out loud.
    const report = presentInvoice(parseQrParameters(resource.example.url_corrected));
    expect(report.power.price_basis).toBe('annual');
    expect(report.inferences.map((i) => i.id)).toContain('power_price_annual_basis');
  });
});

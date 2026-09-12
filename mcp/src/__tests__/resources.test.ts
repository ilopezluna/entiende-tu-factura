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
import { powerMethodResource } from '../resources';

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

import { describe, it, expect } from 'vitest';

import { parseQrParameters, type QrParameters } from '../../../src/lib/cnmc';
import { presentInvoice } from '../present';

/**
 * The same synthetic invoice the web app was driven with during verification.
 * The figures asserted below are exactly what the site displays for it, which is
 * what makes this a cross-check rather than a snapshot of our own arithmetic.
 */
const CNMC_URL =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=08001&pP1=4.6&pP2=4.6&pmaxP1=2.8&pmaxP2=3.1' +
  '&tc=E0&com=R2-760&cups=ES1234567890AZ&tf=N&iniF=2025-11-28&finF=2025-12-31&fFact=2026-01-04' +
  '&caP1=1088&caP2=672&caP3=1222&iniA=2025-08-31&imp=120.55&impPot=20.84&impEner=77.72' +
  '&prP1=0.10&prP2=0.05&prE1=0.119&prE2=0.120&prE3=0.119';

const report = presentInvoice(parseQrParameters(CNMC_URL));

describe('presentInvoice', () => {
  it('reports the supply point in full', () => {
    expect(report.supply).toEqual({
      cups: 'ES1234567890AZ',
      postal_code: '08001',
      retailer_code: 'R2-760',
    });
  });

  it('describes the contract in Spanish', () => {
    expect(report.contract.type).toBe('E');
    expect(report.contract.label).toBe('Fija 3 periodos');
    expect(report.contract.category).toBe('fixed');
    expect(report.contract.single_price).toBe(false);
    expect(report.contract.invoice_type_label).toBe('Normal');
  });

  it('matches the amounts the web app shows for this invoice', () => {
    expect(report.invoice_amounts.total_eur).toBe(120.55);
    expect(report.invoice_amounts.power_eur).toBe(20.84);
    expect(report.invoice_amounts.energy_eur).toBe(77.72);
    expect(report.invoice_amounts.other_eur).toBe(21.99);
  });

  it('matches the monthly estimate the web app shows for this invoice', () => {
    expect(report.monthly_estimate.energy_eur).toBe(85.88);
    expect(report.monthly_estimate.power_eur).toBe(21);
    expect(report.monthly_estimate.total_eur).toBe(136.95);
    const taxes =
      report.monthly_estimate.electricity_tax_eur +
      report.monthly_estimate.equipment_fee_eur +
      report.monthly_estimate.iva_eur;
    expect(Math.round(taxes * 100) / 100).toBe(30.06);
  });

  it('counts the billing period in days', () => {
    expect(report.billing_period.days).toBe(33);
    expect(report.billing_period.start).toBe('2025-11-28');
    expect(report.billing_period.end).toBe('2025-12-31');
  });

  it('reports the power price basis it inferred', () => {
    expect(report.power.price_basis).toBe('daily');
    expect(report.power.contracted_kw).toEqual({ p1: 4.6, p2: 4.6 });
    expect(report.power.max_demanded_kw).toEqual({ p1: 2.8, p2: 3.1 });
  });

  it('takes the annual window from the dates when they are consistent', () => {
    expect(report.consumption.annual_window_source).toBe('dates');
    expect(report.inferences).toEqual([]);
  });

  it('hands back the parsed fields so later calls can skip re-reading the file', () => {
    expect(report.invoice.cups).toBe('ES1234567890AZ');
    expect(report.invoice.pP1).toBe(4.6);
  });
});

describe('presentInvoice inferences', () => {
  const withParams = (overrides: Partial<QrParameters>) =>
    presentInvoice({ ...parseQrParameters(CNMC_URL), ...overrides });

  it('flags an annual window corrected against the billing consumption', () => {
    // iniA set to the billing period start, the failure mode this heuristic exists for.
    const suspect = withParams({ iniA: '2025-11-28', cfP1: 90, cfP2: 55, cfP3: 100 });
    expect(suspect.consumption.annual_window_source).toBe('consumption');

    const [inference] = suspect.inferences;
    expect(inference.id).toBe('annual_window_estimated');
    expect(inference.field).toBe('consumption.annual_window_months');
    expect(inference.inferred).toBe(suspect.consumption.annual_window_months);
    expect(inference.instead_of).toMatchObject({ iniA: '2025-11-28' });
    expect(inference.affects).toContain('monthly_estimate');
  });

  it('flags power prices read as annual rather than daily', () => {
    const indexed = withParams({ prP1: 36.5, prP2: 0.9 });
    expect(indexed.power.price_basis).toBe('annual');

    const [inference] = indexed.inferences;
    expect(inference.id).toBe('power_price_annual_basis');
    expect(inference.instead_of).toMatchObject({ prP1: 36.5, read_as: '€/kW/año' });
    expect(inference.inferred).toEqual(indexed.prices.power_eur_per_kw_day);
  });

  it('flags an estimate derived from the total instead of unit prices', () => {
    const noEnergyPrices = withParams({ prE1: undefined, prE2: undefined, prE3: undefined });
    expect(noEnergyPrices.inferences.map((i) => i.id)).toContain('monthly_estimate_from_total');
  });

  it('stays silent about fields the QR simply does not carry', () => {
    // A null is visible to the agent on its own; restating it would be prose, not provenance.
    const noPrices = withParams({ prP1: undefined, prP2: undefined });
    expect(noPrices.power.price_basis).toBeNull();
    expect(noPrices.inferences.map((i) => i.id)).not.toContain('power_price_annual_basis');

    const noMax = withParams({ pmaxP1: 0, pmaxP2: 0 });
    expect(noMax.power.max_demanded_kw).toEqual({ p1: null, p2: null });
    expect(noMax.inferences).toEqual([]);
  });
});

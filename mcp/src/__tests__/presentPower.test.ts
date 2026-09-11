import { describe, it, expect } from 'vitest';

import { parseQrParameters, type QrParameters } from '../../../src/lib/cnmc';
import { presentPower, presentSimulation } from '../presentPower';

const CNMC_URL =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=08001&pP1=4.6&pP2=4.6&pmaxP1=2.8&pmaxP2=3.1' +
  '&tc=E0&com=R2-760&cups=ES1234567890AZ&tf=N&iniF=2025-11-28&finF=2025-12-31&fFact=2026-01-04' +
  '&caP1=1088&caP2=672&caP3=1222&iniA=2025-08-31&imp=120.55&impPot=20.84&impEner=77.72' +
  '&prP1=0.10&prP2=0.05&prE1=0.119&prE2=0.120&prE3=0.119';

const base = parseQrParameters(CNMC_URL);
const withParams = (overrides: Partial<QrParameters>) => ({ ...base, ...overrides });

describe('presentPower', () => {
  it('matches the savings the web app shows for this invoice', () => {
    const report = presentPower(base);
    expect(report.verdict).toBe('lower-possible');
    expect(report.periods.map((p) => p.recommended_kw)).toEqual([3.1, 3.5]);
    expect(report.periods.map((p) => p.freed_kw)).toEqual([1.5, 1.1]);
    expect(report.periods.map((p) => p.annual_saving_base_eur)).toEqual([54.75, 20.08]);
    expect(report.annual_saving?.base_eur).toBe(74.83);
    expect(report.annual_saving?.total_eur).toBe(95.17);
  });

  it('works out how long the change fee takes to pay back', () => {
    const report = presentPower(base);
    expect(report.change_fee_eur).toBe(10.94);
    expect(report.payback_months).toBeCloseTo(1.4, 1);
    expect(report.worth_it).toBe(true);
  });

  it('writes a verdict the agent can relay, with the real figures in it', () => {
    const report = presentPower(base);
    expect(report.verdict_es).toContain('95,17€');
    expect(report.verdict_es).toContain('3,10 kW');
    expect(report.verdict_label).toBe('Puedes bajar la potencia contratada');
  });

  it('says not to lower the power when the meter reached the contracted level', () => {
    const report = presentPower(withParams({ pmaxP1: 4.8 }));
    expect(report.verdict).toBe('tight');
    expect(report.verdict_es).toContain('No bajes la potencia');
    expect(report.verdict_es).toContain('punta');
  });

  it('says to keep the power when it is already well fitted', () => {
    const report = presentPower(withParams({ pP1: 3.1, pP2: 3.5 }));
    expect(report.verdict).toBe('keep');
    expect(report.verdict_es).toContain('ya se ajusta');
  });

  it('explains what is missing when there is no maximum demand', () => {
    const report = presentPower(withParams({ pmaxP1: 0, pmaxP2: 0 }));
    expect(report.verdict).toBe('no-data');
    expect(report.has_max_demand).toBe(false);
    expect(report.annual_saving).toBeNull();
    expect(report.payback_months).toBeNull();
    expect(report.verdict_es).toContain('distribuidora');
  });

  it('still recommends a reduction without prices, but cannot cost it', () => {
    const report = presentPower(withParams({ prP1: undefined, prP2: undefined }));
    expect(report.verdict).toBe('lower-possible');
    expect(report.has_prices).toBe(false);
    expect(report.annual_saving).toBeNull();
    expect(report.verdict_es).toContain('no trae los precios de potencia');
  });
});

describe('presentSimulation', () => {
  it('costs a specific pair of powers', () => {
    const report = presentSimulation(base, 3.1, 3.5);
    expect(report.proposed_kw).toEqual({ p1: 3.1, p2: 3.5 });
    expect(report.annual_saving?.total_eur).toBe(95.17);
    expect(report.warnings).toEqual([]);
  });

  it('warns when a proposal sits below the power actually demanded', () => {
    const report = presentSimulation(base, 2.0, 3.5);
    expect(report.warnings.join(' ')).toContain('por debajo de los 2,80 kW');
    expect(report.warnings.join(' ')).toContain('diferencial');
  });

  it('warns when a proposal leaves less than the safety margin', () => {
    const report = presentSimulation(base, 3.0, 3.5);
    expect(report.warnings.join(' ')).toContain('menos del 10% de margen');
  });

  it('warns when the proposal raises the power instead of lowering it', () => {
    const report = presentSimulation(base, 5.5, 5.5);
    expect(report.warnings.join(' ')).toContain('subir la potencia');
  });

  it('says so plainly when there are no prices to work from', () => {
    const report = presentSimulation(withParams({ prP1: undefined, prP2: undefined }), 3.1, 3.5);
    expect(report.annual_saving).toBeNull();
    expect(report.summary_es).toContain('no trae los precios de potencia');
  });
});

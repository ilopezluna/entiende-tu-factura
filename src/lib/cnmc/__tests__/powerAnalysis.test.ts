import { analyzePower, applyTaxCascade, roundUpToStep, simulateAnnualSaving } from '../utils';
import { QrParameters } from '../types';

// =============================================================================
// Helpers
// =============================================================================

/** Minimal valid QrParameters; override the fields relevant to each case. */
const baseQrParams = (overrides: Partial<QrParameters> = {}): QrParameters => ({
  cp: '08001',
  cups: 'ES0000000000000000AB',
  com: 'R2-001',
  pP1: 4.6,
  pP2: 4.6,
  pmaxP1: 0,
  pmaxP2: 0,
  caP1: 0,
  caP2: 0,
  caP3: 0,
  impPot: 0,
  iniA: '2025-01-01',
  tc: 'E0',
  ...overrides,
});

// =============================================================================
// roundUpToStep
// =============================================================================

describe('roundUpToStep', () => {
  it.each([
    [3.08, 3.1],
    [3.41, 3.5],
    [3.5, 3.5], // exact multiple does not bump up
    [3.3000000000000003, 3.3], // float noise absorbed by the epsilon
    [0.44, 0.5],
  ])('rounds %f up to %f', (value, expected) => {
    expect(roundUpToStep(value)).toBeCloseTo(expected, 10);
  });
});

// =============================================================================
// applyTaxCascade
// =============================================================================

describe('applyTaxCascade', () => {
  it('applies electricity tax and IVA on top (cascade)', () => {
    const result = applyTaxCascade(100);
    expect(result.base).toBe(100);
    expect(result.electricityTax).toBeCloseTo(5.113, 3);
    expect(result.iva).toBeCloseTo(22.074, 3);
    expect(result.total).toBeCloseTo(127.186, 3);
  });
});

// =============================================================================
// analyzePower
// =============================================================================

describe('analyzePower', () => {
  it('recommends lowering with daily prices (F0), applying margin, rounding and cascade', () => {
    const analysis = analyzePower(
      baseQrParams({ pmaxP1: 2.8, pmaxP2: 3.1, prP1: 0.1, prP2: 0.05 }),
    );

    expect(analysis.verdict).toBe('lower-possible');
    expect(analysis.hasMaxDemand).toBe(true);
    expect(analysis.hasPrices).toBe(true);

    const [p1, p2] = analysis.periods;
    // P1: 2.8 × 1.1 = 3.08 → 3.1; freed = 4.6 − 3.1 = 1.5
    expect(p1.recommendedKw).toBeCloseTo(3.1, 10);
    expect(p1.freedKw).toBeCloseTo(1.5, 10);
    // P2: 3.1 × 1.1 = 3.41 → 3.5; freed = 4.6 − 3.5 = 1.1
    expect(p2.recommendedKw).toBeCloseTo(3.5, 10);
    expect(p2.freedKw).toBeCloseTo(1.1, 10);

    // base = 1.5 × 0.10 × 365 + 1.1 × 0.05 × 365 = 54.75 + 20.075 = 74.825
    expect(analysis.totalAnnualSaving?.base).toBeCloseTo(74.825, 3);
    expect(analysis.totalAnnualSaving?.total).toBeCloseTo(95.17, 1);
  });

  it('normalizes annual prices (A0) via the shared price heuristic', () => {
    const analysis = analyzePower(
      // prP1 > 1 → annual mode for both; prP2 = 1.5 €/kW/año must NOT be daily
      baseQrParams({ pmaxP1: 2.8, pmaxP2: 3.1, prP1: 30, prP2: 1.5 }),
    );

    // base = 1.5 × (30/365) × 365 + 1.1 × (1.5/365) × 365 = 45 + 1.65 = 46.65
    expect(analysis.totalAnnualSaving?.base).toBeCloseTo(46.65, 3);
  });

  it('returns no-data when pmax is missing in every period', () => {
    const analysis = analyzePower(baseQrParams({ prP1: 0.1, prP2: 0.05 }));

    expect(analysis.verdict).toBe('no-data');
    expect(analysis.hasMaxDemand).toBe(false);
    expect(analysis.totalAnnualSaving).toBeNull();
    expect(analysis.periods[0].maxDemandKw).toBeNull();
    expect(analysis.periods[0].recommendedKw).toBeNull();
    expect(analysis.periods[0].contractedKw).toBe(4.6);
  });

  it('returns tight when max demand equals the contracted power', () => {
    const analysis = analyzePower(
      baseQrParams({ pmaxP1: 4.6, pmaxP2: 3.0, prP1: 0.1, prP2: 0.05 }),
    );

    expect(analysis.verdict).toBe('tight');
    expect(analysis.periods[0].freedKw).toBe(0);
  });

  it('returns tight (freed never negative) when max demand exceeds the contracted power', () => {
    const analysis = analyzePower(baseQrParams({ pmaxP1: 5.2, pmaxP2: 3.0 }));

    expect(analysis.verdict).toBe('tight');
    expect(analysis.periods[0].freedKw).toBe(0);
    expect(analysis.periods[0].recommendedKw).toBeCloseTo(4.6, 10); // clamped to contracted
  });

  it('returns keep when the margin + rounding cancels the freed power', () => {
    const analysis = analyzePower(
      baseQrParams({ pP1: 3.45, pP2: 3.45, pmaxP1: 3.2, pmaxP2: 3.2, prP1: 0.1, prP2: 0.05 }),
    );

    // 3.2 × 1.1 = 3.52 → 3.6 > 3.45 → clamp to 3.45 → freed 0
    expect(analysis.verdict).toBe('keep');
    expect(analysis.periods[0].recommendedKw).toBeCloseTo(3.45, 10);
    expect(analysis.periods[0].freedKw).toBe(0);
    expect(analysis.totalAnnualSaving).toBeNull();
  });

  it('never recommends below the minimum floor of 1.0 kW', () => {
    const analysis = analyzePower(baseQrParams({ pmaxP1: 0.4, pmaxP2: 0.4 }));

    expect(analysis.periods[0].recommendedKw).toBeCloseTo(1.0, 10);
  });

  it('gives a kW diagnosis without euros when the QR has no power prices', () => {
    const analysis = analyzePower(baseQrParams({ pmaxP1: 2.8, pmaxP2: 3.1 }));

    expect(analysis.verdict).toBe('lower-possible');
    expect(analysis.hasPrices).toBe(false);
    expect(analysis.totalAnnualSaving).toBeNull();
    expect(analysis.periods[0].annualSavingBase).toBeNull();
    expect(analysis.periods[0].freedKw).toBeCloseTo(1.5, 10);
  });

  it('recommends lowering when only one period has margin', () => {
    const analysis = analyzePower(
      baseQrParams({ pmaxP1: 4.5, pmaxP2: 2.0, prP1: 0.1, prP2: 0.05 }),
    );

    // P1: 4.5 × 1.1 = 4.95 → 5.0 > 4.6 → clamp → freed 0
    expect(analysis.periods[0].freedKw).toBe(0);
    expect(analysis.periods[1].freedKw).toBeGreaterThan(0);
    expect(analysis.verdict).toBe('lower-possible');
  });
});

// =============================================================================
// simulateAnnualSaving
// =============================================================================

describe('simulateAnnualSaving', () => {
  const qrParams = baseQrParams({ pmaxP1: 2.8, pmaxP2: 3.1, prP1: 0.1, prP2: 0.05 });

  it('returns zero when simulating the currently contracted power', () => {
    const result = simulateAnnualSaving(qrParams, { p1Kw: 4.6, p2Kw: 4.6 });
    expect(result?.total).toBeCloseTo(0, 10);
  });

  it('computes the saving with the tax cascade for a lower power', () => {
    const result = simulateAnnualSaving(qrParams, { p1Kw: 3.5, p2Kw: 3.5 });
    // base = 1.1 × 0.10 × 365 + 1.1 × 0.05 × 365 = 60.225
    expect(result?.base).toBeCloseTo(60.225, 3);
    expect(result?.total).toBeCloseTo(76.6, 1);
  });

  it('returns a negative saving when the simulated power is higher', () => {
    const result = simulateAnnualSaving(qrParams, { p1Kw: 5.0, p2Kw: 5.0 });
    expect(result?.total).toBeLessThan(0);
  });

  it('returns null when the QR has no power prices', () => {
    const result = simulateAnnualSaving(baseQrParams({ pmaxP1: 2.8 }), { p1Kw: 3.5, p2Kw: 3.5 });
    expect(result).toBeNull();
  });
});

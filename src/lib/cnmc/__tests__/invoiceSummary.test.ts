import { describe, it, expect } from 'vitest';
import {
  calculateBreakdownPercentages,
  calculatePeriodDays,
  splitInvoiceAmounts,
  getPermanenciaStatus,
  FALLBACK_BREAKDOWN_PERCENTAGES,
} from '../utils/invoiceSummary';
import type { CostBreakdown } from '../utils/costCalculations';
import type { QrParameters } from '../types';

const baseBreakdown = (overrides: Partial<CostBreakdown> = {}): CostBreakdown => ({
  energyByPeriod: [],
  actualMonths: 12,
  totalEnergyCost: 0,
  monthlyEnergyCost: 50,
  totalPowerCost: 0,
  monthlyPowerCost: 30,
  subtotalElectricity: 80,
  electricityTax: 4,
  electricityTaxRate: 0.0511269632,
  equipmentFee: 0.83,
  subtotalBeforeIVA: 84.83,
  iva: 15.17,
  ivaRate: 0.21,
  totalMonthlyCost: 100,
  ...overrides,
});

const baseQrParams = (overrides: Partial<QrParameters> = {}): QrParameters => ({
  cp: '28001',
  cups: 'ES0000000000000000AA0A',
  com: '0001',
  pP1: 4.6,
  pP2: 4.6,
  pmaxP1: 3.2,
  pmaxP2: 2.1,
  caP1: 1000,
  caP2: 800,
  caP3: 600,
  iniA: '2024-01-01',
  tc: 'E0',
  impPot: 20,
  ...overrides,
});

describe('calculateBreakdownPercentages', () => {
  it('splits the monthly estimate into energy, power and taxes', () => {
    const result = calculateBreakdownPercentages(baseBreakdown());
    expect(result).toEqual({ energy: 50, power: 30, taxes: 20 });
  });

  it('falls back to a fixed split when there is no total to divide by', () => {
    expect(calculateBreakdownPercentages(baseBreakdown({ totalMonthlyCost: 0 }))).toEqual(
      FALLBACK_BREAKDOWN_PERCENTAGES,
    );
  });

  it('returns a copy of the fallback so callers cannot mutate it', () => {
    const result = calculateBreakdownPercentages(baseBreakdown({ totalMonthlyCost: -5 }));
    result.energy = 99;
    expect(FALLBACK_BREAKDOWN_PERCENTAGES.energy).toBe(45);
  });
});

describe('calculatePeriodDays', () => {
  it('counts the days between the billing period bounds', () => {
    expect(calculatePeriodDays(baseQrParams({ iniF: '2024-03-01', finF: '2024-03-31' }))).toBe(30);
  });

  it('returns null when either bound is missing', () => {
    expect(calculatePeriodDays(baseQrParams({ iniF: '2024-03-01' }))).toBeNull();
    expect(calculatePeriodDays(baseQrParams({ finF: '2024-03-31' }))).toBeNull();
  });

  it('returns null for unparseable dates', () => {
    expect(
      calculatePeriodDays(baseQrParams({ iniF: 'no-es-fecha', finF: '2024-03-31' })),
    ).toBeNull();
  });

  it('returns null when the period is empty or inverted', () => {
    expect(
      calculatePeriodDays(baseQrParams({ iniF: '2024-03-31', finF: '2024-03-01' })),
    ).toBeNull();
    expect(
      calculatePeriodDays(baseQrParams({ iniF: '2024-03-01', finF: '2024-03-01' })),
    ).toBeNull();
  });
});

describe('splitInvoiceAmounts', () => {
  it('takes power and energy from the QR and leaves the rest as other', () => {
    const result = splitInvoiceAmounts(baseQrParams({ imp: 100, impPot: 20, impEner: 50 }));
    expect(result).toEqual({
      total: 100,
      power: 20,
      energy: 50,
      other: 30,
      percentages: { energy: 50, power: 20, taxes: 30 },
    });
  });

  it('never reports a negative remainder', () => {
    const result = splitInvoiceAmounts(baseQrParams({ imp: 40, impPot: 30, impEner: 30 }));
    expect(result.other).toBe(0);
  });

  it('returns nulls and zero percentages when the total is missing', () => {
    const result = splitInvoiceAmounts(baseQrParams({ impPot: 20, impEner: 50 }));
    expect(result.total).toBeNull();
    expect(result.other).toBeNull();
    expect(result.percentages).toEqual({ energy: 0, power: 0, taxes: 0 });
  });

  it('treats zero amounts as absent', () => {
    const result = splitInvoiceAmounts(baseQrParams({ imp: 100, impPot: 0, impEner: 0 }));
    expect(result.power).toBeNull();
    expect(result.energy).toBeNull();
    expect(result.other).toBe(100);
  });
});

describe('getPermanenciaStatus', () => {
  it('reports an active penalty while the end date is in the future', () => {
    const result = getPermanenciaStatus(
      baseQrParams({ finPen: '2025-06-30' }),
      new Date('2025-01-15T10:00:00'),
    );
    expect(result).toEqual({ endDate: '2025-06-30', isActive: true });
  });

  it('reports an expired penalty once the end date has passed', () => {
    const result = getPermanenciaStatus(
      baseQrParams({ finPen: '2024-06-30' }),
      new Date('2025-01-15T10:00:00'),
    );
    expect(result).toEqual({ endDate: '2024-06-30', isActive: false });
  });

  it('is not active on the end date itself', () => {
    const result = getPermanenciaStatus(
      baseQrParams({ finPen: '2025-01-15' }),
      new Date('2025-01-15T23:59:00'),
    );
    expect(result?.isActive).toBe(false);
  });

  it('returns null for a missing date or the 0000-00-00 sentinel', () => {
    expect(getPermanenciaStatus(baseQrParams())).toBeNull();
    expect(getPermanenciaStatus(baseQrParams({ finPen: '0000-00-00' }))).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    expect(getPermanenciaStatus(baseQrParams({ finPen: 'pendiente' }))).toBeNull();
  });
});

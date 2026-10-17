import { QrParameters } from '../types';

// Tax rates and fixed charges
export const ELECTRICITY_TAX_RATE = 0.0511269632; // 5.11269632%
export const IVA_RATE = 0.21; // 21%
const DAYS_PER_MONTH = 365.25 / 12; // 30.4375 average days per month

/**
 * Power (fixed term) cost breakdown for a single period.
 *
 * Prices are normalized to a daily rate so the value matches what invoices show
 * (€/kW/día), regardless of whether the QR encodes daily (F0) or annual (A0) prices.
 */
export interface PowerPeriodCost {
  period: 'P1' | 'P2';
  label: 'Punta' | 'Valle';
  power: number; // kW contracted (pP1/pP2)
  pricePerDay: number; // €/kW/día (normalized)
  monthlyCost: number; // €/mes = power × pricePerDay × DAYS_PER_MONTH
}

/**
 * Whether the QR encodes power prices per day or per year.
 *
 * The format differs by tariff type, and the mode is decided once from the
 * dominant price (the punta price), then applied to both periods:
 * - F0 (2.0TD estándar): prP1/prP2 in €/kW/día (daily rate, typically < 1)
 * - A0 (indexada): prP1/prP2 in €/kW/año (annual rate, typically > 20). Note the
 *   valle annual price can be < 1, so it must NOT be reclassified as daily.
 *
 * Exported because it is an inference, not a fact from the invoice: consumers
 * that present these figures should be able to say which reading they used.
 *
 * @returns The basis, or null when the QR carries no power prices at all.
 */
export const getPowerPriceBasis = (qrParams: QrParameters): 'daily' | 'annual' | null => {
  if (qrParams.prP1 === undefined && qrParams.prP2 === undefined) return null;
  return (qrParams.prP1 ?? 0) > 1 || (qrParams.prP2 ?? 0) > 1 ? 'annual' : 'daily';
};

export const calculatePowerByPeriod = (qrParams: QrParameters): PowerPeriodCost[] => {
  const isAnnual = getPowerPriceBasis(qrParams) === 'annual';

  const periods = [
    { period: 'P1' as const, label: 'Punta' as const, power: qrParams.pP1, price: qrParams.prP1 },
    { period: 'P2' as const, label: 'Valle' as const, power: qrParams.pP2, price: qrParams.prP2 },
  ];

  return periods
    .filter((p) => p.price !== undefined)
    .map(({ period, label, power, price }) => {
      const p = price as number;
      // Display price is always normalized to €/kW/día.
      const pricePerDay = isAnnual ? p / 365 : p;
      // Monthly cost mirrors the historical formula per mode (annual ÷ 12, daily × days).
      const monthlyCost = isAnnual ? (power * p) / 12 : power * p * DAYS_PER_MONTH;
      return { period, label, power, pricePerDay, monthlyCost };
    });
};

import { QrParameters } from '../types';
import {
  calculatePowerByPeriod,
  ELECTRICITY_TAX_RATE,
  IVA_RATE,
  PowerPeriodCost,
} from './costCalculations';

/**
 * Contracted power analysis: compares the contracted power (pP1/pP2) against
 * the maximum power demanded in the last year (pmaxP1/pmaxP2, measured by the
 * smart meter and encoded in the CNMC QR) to decide whether the user could
 * lower their contracted power, and estimates the annual saving.
 *
 * Pure functions over QrParameters — nothing leaves the browser.
 */

/** Safety margin applied on top of the max demanded power (+10%). */
export const SAFETY_MARGIN = 0.1;
/** Power can be contracted in 0.1 kW steps (supplies ≤ 15 kW). */
export const POWER_STEP_KW = 0.1;
/** Prudent floor for the recommendation (fridge + basic appliances). */
export const MIN_RECOMMENDED_POWER_KW = 1.0;
/** Days used to annualize the €/kW/día price (matches the annual/365 normalization). */
export const DAYS_PER_YEAR = 365;
/** One-off fee for lowering power (derechos de enganche): 9,04 € + 21% IVA. */
export const POWER_CHANGE_FEE_EUR = 10.94;

export type PowerVerdict =
  | 'lower-possible' // there is margin: lowering is recommended
  | 'keep' // the recommendation matches what is already contracted
  | 'tight' // max demand reached (or exceeded) the contracted power
  | 'no-data'; // pmax missing/0 in every period → no automatic verdict

export interface PeriodPowerAnalysis {
  period: 'P1' | 'P2';
  label: 'Punta' | 'Valle';
  contractedKw: number; // pP1 / pP2
  maxDemandKw: number | null; // pmaxP1/pmaxP2; null when missing or 0
  recommendedKw: number | null; // null when there is no max demand data
  freedKw: number; // contractedKw − recommendedKw (never negative)
  pricePerDay: number | null; // €/kW/día normalized; null when the QR has no price
  annualSavingBase: number | null; // freedKw × pricePerDay × 365, without taxes
}

export interface SavingsBreakdown {
  base: number; // €/year without taxes
  electricityTax: number; // base × 5,11269632%
  iva: number; // (base + electricityTax) × 21%
  total: number; // base + electricityTax + iva
}

export interface PowerAnalysis {
  verdict: PowerVerdict;
  periods: PeriodPowerAnalysis[];
  hasMaxDemand: boolean; // some pmax > 0
  hasPrices: boolean; // some power price available in the QR
  totalAnnualSaving: SavingsBreakdown | null; // null without prices or without freed kW
  safetyMargin: number; // echo of SAFETY_MARGIN for the UI
}

/**
 * Round UP to the nearest multiple of `step` (default 0.1 kW), with an epsilon
 * so float noise (e.g. 3.3000000000000003) does not bump to the next step.
 */
export const roundUpToStep = (value: number, step: number = POWER_STEP_KW): number => {
  const steps = Math.ceil(value / step - 1e-9);
  // Snap float noise from steps × step (supports any step with up to 6 decimals).
  return Math.round(steps * step * 1e6) / 1e6;
};

/**
 * Apply the tax cascade used in Spanish electricity invoices: the electricity
 * tax (5,11%) applies on the base, and IVA (21%) applies on base + tax.
 */
export const applyTaxCascade = (base: number): SavingsBreakdown => {
  const electricityTax = base * ELECTRICITY_TAX_RATE;
  const iva = (base + electricityTax) * IVA_RATE;
  return { base, electricityTax, iva, total: base + electricityTax + iva };
};

/**
 * Normalized €/kW/día prices by period, reusing calculatePowerByPeriod so the
 * daily/annual price heuristic lives in a single place.
 */
const pricesByPeriod = (qrParams: QrParameters): Map<'P1' | 'P2', PowerPeriodCost> =>
  new Map(calculatePowerByPeriod(qrParams).map((p) => [p.period, p]));

export const analyzePower = (qrParams: QrParameters): PowerAnalysis => {
  const prices = pricesByPeriod(qrParams);

  const rawPeriods = [
    {
      period: 'P1' as const,
      label: 'Punta' as const,
      contractedKw: qrParams.pP1,
      max: qrParams.pmaxP1,
    },
    {
      period: 'P2' as const,
      label: 'Valle' as const,
      contractedKw: qrParams.pP2,
      max: qrParams.pmaxP2,
    },
  ];

  const periods: PeriodPowerAnalysis[] = rawPeriods.map(({ period, label, contractedKw, max }) => {
    const maxDemandKw = max > 0 ? max : null;
    const pricePerDay = prices.get(period)?.pricePerDay ?? null;

    let recommendedKw: number | null = null;
    let freedKw = 0;
    if (maxDemandKw !== null) {
      const withMargin = Math.max(
        roundUpToStep(maxDemandKw * (1 + SAFETY_MARGIN)),
        MIN_RECOMMENDED_POWER_KW,
      );
      recommendedKw = Math.min(withMargin, contractedKw);
      freedKw = Math.max(Math.round((contractedKw - recommendedKw) * 10) / 10, 0);
    }

    const annualSavingBase =
      maxDemandKw !== null && pricePerDay !== null ? freedKw * pricePerDay * DAYS_PER_YEAR : null;

    return {
      period,
      label,
      contractedKw,
      maxDemandKw,
      recommendedKw,
      freedKw,
      pricePerDay,
      annualSavingBase,
    };
  });

  const hasMaxDemand = periods.some((p) => p.maxDemandKw !== null);
  const hasPrices = periods.some((p) => p.pricePerDay !== null);
  const totalFreedKw = periods.reduce((sum, p) => sum + p.freedKw, 0);

  let verdict: PowerVerdict;
  if (!hasMaxDemand) {
    verdict = 'no-data';
  } else if (periods.some((p) => p.maxDemandKw !== null && p.maxDemandKw >= p.contractedKw)) {
    verdict = 'tight';
  } else if (totalFreedKw >= POWER_STEP_KW - 1e-9) {
    verdict = 'lower-possible';
  } else {
    verdict = 'keep';
  }

  const base = periods.reduce((sum, p) => sum + (p.annualSavingBase ?? 0), 0);
  const totalAnnualSaving = hasPrices && base > 0 ? applyTaxCascade(base) : null;

  return {
    verdict,
    periods,
    hasMaxDemand,
    hasPrices,
    totalAnnualSaving,
    safetyMargin: SAFETY_MARGIN,
  };
};

/**
 * Annual saving (with the tax cascade) if the user contracted p1Kw/p2Kw
 * instead of the current pP1/pP2. Negative when the new power costs more.
 * Periods without a price in the QR are ignored; returns null when no period
 * has a price at all.
 */
export const simulateAnnualSaving = (
  qrParams: QrParameters,
  newPowers: { p1Kw: number; p2Kw: number },
): SavingsBreakdown | null => {
  const prices = calculatePowerByPeriod(qrParams);
  if (prices.length === 0) return null;

  const targetKw = { P1: newPowers.p1Kw, P2: newPowers.p2Kw };
  const base = prices.reduce(
    (sum, p) => sum + (p.power - targetKw[p.period]) * p.pricePerDay * DAYS_PER_YEAR,
    0,
  );
  return applyTaxCascade(base);
};

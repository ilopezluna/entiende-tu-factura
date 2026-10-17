/**
 * CNMC Utils
 * Cost calculation utilities for CNMC parameters
 */

export {
  calculatePowerByPeriod,
  getPowerPriceBasis,
  ELECTRICITY_TAX_RATE,
  IVA_RATE,
  type PowerPeriodCost,
} from './costCalculations';

export {
  analyzePower,
  applyTaxCascade,
  roundUpToStep,
  simulateAnnualSaving,
  SAFETY_MARGIN,
  POWER_STEP_KW,
  MIN_RECOMMENDED_POWER_KW,
  DAYS_PER_YEAR,
  POWER_CHANGE_FEE_EUR,
  type PowerAnalysis,
  type PeriodPowerAnalysis,
  type SavingsBreakdown,
  type PowerVerdict,
} from './powerAnalysis';

export {
  calculatePeriodDays,
  splitInvoiceAmounts,
  getPermanenciaStatus,
  getCostPerDay,
  type BreakdownPercentages,
  type InvoiceAmountSplit,
  type PermanenciaStatus,
} from './invoiceSummary';

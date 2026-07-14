/**
 * CNMC Utils
 * Cost calculation utilities for CNMC parameters
 */

export {
  calculateActualMonths,
  calculateCostBreakdown,
  calculatePowerByPeriod,
  ELECTRICITY_TAX_RATE,
  IVA_RATE,
  type EnergyPeriodCost,
  type PowerPeriodCost,
  type CostBreakdown,
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

import { QrParameters } from '../types';

// Tax rates and fixed charges
const ELECTRICITY_TAX_RATE = 0.0511269632; // 5.11269632%
const IVA_RATE = 0.21; // 21%
const EQUIPMENT_FEE = 0.83; // €0.83 fixed monthly
const DAYS_PER_MONTH = 365.25 / 12; // 30.4375 average days per month

/**
 * Energy cost breakdown for a single period
 */
export interface EnergyPeriodCost {
  period: 'P1' | 'P2' | 'P3';
  consumption: number; // kWh
  pricePerKwh: number; // €/kWh
  totalCost: number; // €
}

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
 * Complete cost breakdown for monthly electricity costs
 */
export interface CostBreakdown {
  // Energy breakdown
  energyByPeriod: EnergyPeriodCost[];
  actualMonths: number; // Number of months in period

  totalEnergyCost: number; // € (sum of all periods)
  monthlyEnergyCost: number; // €/mes (totalEnergyCost / actualMonths)

  // Power term
  totalPowerCost: number; // €/actual period (from impPot)
  monthlyPowerCost: number; // €/mes (pP1 × prP1 × days + pP2 × prP2 × days)

  // Subtotals
  subtotalElectricity: number; // €/mes (energy + power)
  electricityTax: number; // € (5.11%)
  electricityTaxRate: number; // Rate applied (0.0511...)
  equipmentFee: number; // € (0.83)
  subtotalBeforeIVA: number; // €

  // IVA
  iva: number; // € (21%)
  ivaRate: number; // Rate applied (0.21)

  // Final total
  totalMonthlyCost: number; // €/mes
}

/**
 * Calculate the actual number of months between the annual consumption start date and invoice date
 *
 * IMPORTANT: iniA is the start date of the annual consumption period (NOT included)
 * So the consumption spans from iniA + 1 day (exclusive start) to the invoice date (inclusive end)
 *
 * We use day-based calculation and convert to fractional months for accuracy:
 * - Calendar months vary (28-31 days)
 * - Using 30.4375 days/month (365.25 ÷ 12) gives accurate average
 *
 * Example:
 * - Start: 2025-08-31 (not included) → actual start is 2025-09-01
 * - End: 2025-10-04 (included)
 * - Days: 34 days (Sept 1-30 = 30 days, Oct 1-4 = 4 days)
 * - Months: 34 ÷ 30.4375 ≈ 1.117 months
 *
 * @param startDate - Start date (iniA) - NOT included in the period
 * @param endDate - End date (fFact or finF) - included in the period
 * @returns Number of months in the period (minimum 0.5 for very short periods)
 */
export const calculateActualMonths = (startDate: string, endDate?: string): number => {
  if (!endDate) {
    // If no end date available, fall back to 12 months as a reasonable default
    console.warn('No end date available for period calculation, using 12 months as default');
    return 12;
  }

  try {
    // Since iniA is NOT included, we start from the next day
    const start = new Date(startDate);
    start.setDate(start.getDate() + 1); // Add 1 day since iniA is not included

    const end = new Date(endDate);

    // Calculate the difference in milliseconds
    const diffMs = end.getTime() - start.getTime();

    // Convert to days (including the end date since it's inclusive)
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

    // Convert days to months using average days per month (365.25 ÷ 12 = 30.4375)
    // This accounts for leap years
    const months = diffDays / DAYS_PER_MONTH;

    // Ensure at least 0.5 months for very short periods (15 days)
    return Math.max(months, 0.5);
  } catch (error) {
    console.error('Error calculating months difference:', error);
    return 12; // Fall back to 12 months
  }
};

/**
 * Calculate detailed cost breakdown for monthly electricity costs
 *
 * This function provides a complete breakdown of all cost components,
 * useful for displaying to users how their monthly cost is calculated.
 *
 * @param qrParams - QR parameters from the invoice
 * @returns CostBreakdown object with all cost components
 */
export const calculatePowerByPeriod = (qrParams: QrParameters): PowerPeriodCost[] => {
  // Price format differs by tariff type, and the mode is decided once from the
  // dominant price (the punta price), then applied to both periods:
  // - F0 (2.0TD estándar): prP1/prP2 in €/kW/día (daily rate, typically < 1)
  // - A0 (indexada): prP1/prP2 in €/kW/año (annual rate, typically > 20). Note the
  //   valle annual price can be < 1, so it must NOT be reclassified as daily.
  const isAnnual = (qrParams.prP1 ?? 0) > 1 || (qrParams.prP2 ?? 0) > 1;

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

export const calculateCostBreakdown = (qrParams: QrParameters): CostBreakdown => {
  // Prices per period, defaulting to prE1 if others not provided
  const prE1 = qrParams.prE1 || 0;
  const prE2 = qrParams.prE2 || prE1;
  const prE3 = qrParams.prE3 || prE1;

  // Calculate actual months in the consumption period
  const actualMonths = calculateActualMonths(qrParams.iniA, qrParams.fFact || qrParams.finF);

  // Build energy breakdown by period
  const energyByPeriod: EnergyPeriodCost[] = [
    {
      period: 'P1',
      consumption: qrParams.caP1 || 0,
      pricePerKwh: prE1,
      totalCost: (qrParams.caP1 || 0) * prE1,
    },
    {
      period: 'P2',
      consumption: qrParams.caP2 || 0,
      pricePerKwh: prE2,
      totalCost: (qrParams.caP2 || 0) * prE2,
    },
    {
      period: 'P3',
      consumption: qrParams.caP3 || 0,
      pricePerKwh: prE3,
      totalCost: (qrParams.caP3 || 0) * prE3,
    },
  ];

  // Calculate total energy cost for the period
  const totalEnergyCost = energyByPeriod.reduce((sum, period) => sum + period.totalCost, 0);

  // Convert to monthly average based on actual period
  const monthlyEnergyCost = totalEnergyCost / actualMonths;

  // Total power cost for the actual period (from the invoice)
  const totalPowerCost = qrParams.impPot;

  // Monthly power cost = sum of the per-period power breakdown (single source of
  // truth, so the contract table total always matches this figure).
  const monthlyPowerCost = calculatePowerByPeriod(qrParams).reduce(
    (sum, p) => sum + p.monthlyCost,
    0,
  );

  // Base electricity cost (power + energy)
  const subtotalElectricity = monthlyEnergyCost + monthlyPowerCost;

  // Apply electricity tax
  const electricityTax = subtotalElectricity * ELECTRICITY_TAX_RATE;

  // Equipment fee
  const equipmentFee = EQUIPMENT_FEE;

  // Calculate subtotal before IVA
  const subtotalBeforeIVA = subtotalElectricity + electricityTax + equipmentFee;

  // Apply IVA
  const iva = subtotalBeforeIVA * IVA_RATE;

  // Calculate final total
  let totalMonthlyCost = subtotalBeforeIVA + iva;

  // Fallback for QRs without unit prices (e.g., old numeric-tc format):
  // the detailed breakdown yields only the equipment fee (~1€/mes).
  // Use the total invoice amount divided by billing period instead.
  const hasUnitPrices = (qrParams.prE1 ?? 0) > 0 || (qrParams.prP1 ?? 0) > 0;
  if (!hasUnitPrices && qrParams.imp && qrParams.imp > 0 && qrParams.iniF && qrParams.finF) {
    const billingMonths = calculateActualMonths(qrParams.iniF, qrParams.finF);
    totalMonthlyCost = qrParams.imp / billingMonths;
  }

  return {
    energyByPeriod,
    actualMonths,

    totalEnergyCost,
    monthlyEnergyCost,

    totalPowerCost,
    monthlyPowerCost,

    subtotalElectricity,
    electricityTax,
    electricityTaxRate: ELECTRICITY_TAX_RATE,
    equipmentFee,
    subtotalBeforeIVA,
    iva,
    ivaRate: IVA_RATE,
    totalMonthlyCost,
  };
};

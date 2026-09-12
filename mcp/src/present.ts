/**
 * Shapes parsed CNMC data into the JSON an agent receives.
 *
 * Keys are English so the calling model reasons about them easily; the few
 * human-readable strings are Spanish so the agent can relay them to its user
 * verbatim. Writing the explanation itself is the agent's job, not this module's.
 *
 * A few figures in here are deduced rather than read off the invoice. Those are
 * listed in `inferences`, because they are the one thing an agent cannot detect
 * for itself: the field holds a number that looks measured. Missing fields are
 * deliberately NOT listed — a null is visible on its own, and restating it in
 * prose would be writing the agent's explanation for it.
 */

import {
  ContractType,
  type QrParameters,
  calculateActualMonths,
  calculateBreakdownPercentages,
  calculateCostBreakdown,
  calculatePeriodDays,
  calculatePowerByPeriod,
  getContractTypeCategory,
  getContractTypeExplanation,
  getContractTypeFromTc,
  getContractTypeLabel,
  getInvoiceTypeExplanation,
  getInvoiceTypeFromTf,
  getInvoiceTypeLabel,
  getPermanenciaStatus,
  getPowerPriceBasis,
  getRevisionFrequencyLabel,
  isSinglePriceContract,
  resolveConsumptionMonths,
  splitInvoiceAmounts,
  formatNumber,
} from '../../src/lib/cnmc';

/** Round to cents, so JSON never carries floating-point noise. */
const eur = (value: number): number => Math.round(value * 100) / 100;

/** Round to a sensible precision for unit prices (€/kWh are quoted to 4 or 6 dp). */
const price = (value: number): number => Math.round(value * 1e6) / 1e6;

const kw = (value: number): number => Math.round(value * 1000) / 1000;

const orNull = (value: number | undefined): number | null =>
  value === undefined ? null : price(value);

/**
 * One figure the server deduced instead of reading it off the invoice.
 *
 * `id` is for branching on, `reason` for relaying to the user. The agent is
 * expected to put `reason` in its own words rather than quote it.
 */
export interface Inference {
  id: 'annual_window_estimated' | 'power_price_annual_basis' | 'monthly_estimate_from_total';
  /** Dotted path to the affected field in this report. */
  field: string;
  /** The value the server ended up publishing at `field`, shaped like that field. */
  inferred: number | Record<string, number | null> | null;
  /** What the QR actually carried, when that is what was overridden. */
  instead_of: Record<string, unknown> | null;
  reason: string;
  /** Other parts of the report that inherit this deduction. */
  affects: string[];
}

export interface InvoiceReport {
  supply: {
    cups: string;
    postal_code: string;
    retailer_code: string;
  };
  contract: {
    code: string;
    type: ContractType | null;
    label: string | null;
    explanation: string | null;
    category: string | null;
    single_price: boolean | null;
    invoice_type: string | null;
    invoice_type_label: string | null;
    invoice_type_explanation: string | null;
    price_revision: string | null;
    contract_end: string | null;
    penalty_end: string | null;
    penalty_active: boolean | null;
    green_energy: boolean | null;
    promotional: boolean | null;
    recently_switched: boolean | null;
  };
  billing_period: {
    start: string | null;
    end: string | null;
    days: number | null;
    invoice_date: string | null;
    total_eur: number | null;
  };
  power: {
    contracted_kw: { p1: number; p2: number };
    max_demanded_kw: { p1: number | null; p2: number | null };
    price_basis: 'daily' | 'annual' | null;
    by_period: {
      period: string;
      label: string;
      contracted_kw: number;
      price_eur_per_kw_day: number;
      monthly_cost_eur: number;
    }[];
  };
  consumption: {
    annual_kwh: { p1: number; p2: number; p3: number; total: number };
    billing_period_kwh: { p1: number; p2: number; p3: number; total: number } | null;
    annual_window_months: number;
    annual_window_source: 'dates' | 'consumption';
    annual_start: string;
  };
  prices: {
    power_eur_per_kw_day: { p1: number | null; p2: number | null };
    energy_eur_per_kwh: { p1: number | null; p2: number | null; p3: number | null };
  };
  invoice_amounts: {
    total_eur: number | null;
    power_eur: number | null;
    energy_eur: number | null;
    other_eur: number | null;
    percentages: { energy: number; power: number; taxes: number };
    social_bonus_eur: number | null;
    discount_eur: number | null;
    adjustment_eur: number | null;
    excess_power_eur: number | null;
    other_with_tax_eur: number | null;
    other_without_tax_eur: number | null;
  };
  monthly_estimate: {
    months_covered: number;
    energy_eur: number;
    power_eur: number;
    subtotal_eur: number;
    electricity_tax_eur: number;
    electricity_tax_rate: number;
    equipment_fee_eur: number;
    iva_eur: number;
    iva_rate: number;
    total_eur: number;
    percentages: { energy: number; power: number; taxes: number };
    energy_by_period: {
      period: string;
      consumption_kwh: number;
      price_eur_per_kwh: number;
      total_cost_eur: number;
    }[];
  };
  /** Figures this module deduced rather than read. Empty when everything is as printed. */
  inferences: Inference[];
  /** The raw parsed QR fields, to pass back into explain_concept without re-reading the file. */
  invoice: QrParameters;
}

/**
 * Which reading of the annual consumption window was used.
 *
 * `resolveConsumptionMonths` silently overrides the dates when a retailer sets
 * iniA to the billing period start; comparing the two tells us whether that
 * correction actually fired.
 */
const annualWindow = (
  qrParams: QrParameters,
): { months: number; source: 'dates' | 'consumption'; monthsFromDates: number } => {
  const resolved = resolveConsumptionMonths(qrParams);
  const fromDates = calculateActualMonths(qrParams.iniA, qrParams.fFact || qrParams.finF);

  return {
    months: Math.round(resolved * 100) / 100,
    source: Math.abs(resolved - fromDates) < 0.01 ? 'dates' : 'consumption',
    monthsFromDates: Math.round(fromDates * 100) / 100,
  };
};

/**
 * List the figures that were deduced rather than read.
 *
 * Only deductions belong here. A field the QR simply does not carry comes back
 * null and the agent can see that for itself; saying so again in Spanish would
 * be writing its explanation for it.
 */
const buildInferences = (
  qrParams: QrParameters,
  report: Omit<InvoiceReport, 'inferences'>,
  window: { monthsFromDates: number },
): Inference[] => {
  const inferences: Inference[] = [];

  if (report.consumption.annual_window_source === 'consumption') {
    inferences.push({
      id: 'annual_window_estimated',
      field: 'consumption.annual_window_months',
      inferred: report.consumption.annual_window_months,
      instead_of: { iniA: qrParams.iniA, implied_months: window.monthsFromDates },
      reason:
        `La fecha de inicio del consumo anual del QR (${qrParams.iniA}) no cuadra con el consumo ` +
        `facturado: implicaría un consumo mensual desproporcionado. Se ha estimado la ventana real ` +
        `en ${formatNumber(report.consumption.annual_window_months, 1)} meses a partir del ritmo ` +
        `de consumo del periodo facturado.`,
      affects: ['consumption.annual_window_months', 'monthly_estimate'],
    });
  }

  if (report.power.price_basis === 'annual') {
    inferences.push({
      id: 'power_price_annual_basis',
      field: 'prices.power_eur_per_kw_day',
      inferred: report.prices.power_eur_per_kw_day,
      instead_of: { prP1: qrParams.prP1, prP2: qrParams.prP2, read_as: '€/kW/año' },
      reason:
        'El QR no indica la unidad del precio de potencia. Por su magnitud se ha leído en €/kW/año ' +
        '(habitual en tarifas indexadas) y se ha convertido a €/kW/día dividiendo entre 365.',
      affects: ['prices.power_eur_per_kw_day', 'power.by_period', 'monthly_estimate.power_eur'],
    });
  }

  if (qrParams.prE1 === undefined) {
    inferences.push({
      id: 'monthly_estimate_from_total',
      field: 'monthly_estimate.total_eur',
      inferred: report.monthly_estimate.total_eur,
      instead_of: null,
      reason:
        'El QR no incluye precios de energía, así que la estimación mensual se ha derivado del ' +
        'importe total de la factura en lugar de calcularse a partir del consumo y los precios.',
      affects: ['monthly_estimate'],
    });
  }

  return inferences;
};

/**
 * Build the full agent-facing report from parsed QR parameters.
 */
export function presentInvoice(qrParams: QrParameters): InvoiceReport {
  const breakdown = calculateCostBreakdown(qrParams);
  const powerPeriods = calculatePowerByPeriod(qrParams);
  const split = splitInvoiceAmounts(qrParams);
  const window = annualWindow(qrParams);
  const contractType = getContractTypeFromTc(qrParams.tc);
  const permanencia = getPermanenciaStatus(qrParams);
  const invoiceType = getInvoiceTypeFromTf(qrParams.tf);

  const billingTotal = (qrParams.cfP1 ?? 0) + (qrParams.cfP2 ?? 0) + (qrParams.cfP3 ?? 0) || null;

  const base: Omit<InvoiceReport, 'inferences'> = {
    supply: {
      cups: qrParams.cups,
      postal_code: qrParams.cp,
      retailer_code: qrParams.com,
    },
    contract: {
      code: qrParams.tc,
      type: contractType,
      label: contractType ? getContractTypeLabel(contractType) : null,
      explanation: contractType ? getContractTypeExplanation(contractType) : null,
      category: contractType ? getContractTypeCategory(contractType) : null,
      single_price: contractType ? isSinglePriceContract(contractType) : null,
      invoice_type: qrParams.tf ?? null,
      invoice_type_label: invoiceType ? getInvoiceTypeLabel(invoiceType) : null,
      invoice_type_explanation: invoiceType ? getInvoiceTypeExplanation(invoiceType) : null,
      price_revision: qrParams.rev !== undefined ? getRevisionFrequencyLabel(qrParams.rev) : null,
      contract_end: qrParams.finContrato ?? null,
      penalty_end: permanencia?.endDate ?? null,
      penalty_active: permanencia?.isActive ?? null,
      green_energy: qrParams.verde !== undefined ? qrParams.verde === 1 : null,
      promotional: qrParams.promo !== undefined ? qrParams.promo === 1 : null,
      recently_switched: qrParams.cambio !== undefined ? qrParams.cambio === 1 : null,
    },
    billing_period: {
      start: qrParams.iniF ?? null,
      end: qrParams.finF ?? null,
      days: calculatePeriodDays(qrParams),
      invoice_date: qrParams.fFact ?? null,
      total_eur: split.total !== null ? eur(split.total) : null,
    },
    power: {
      contracted_kw: { p1: kw(qrParams.pP1), p2: kw(qrParams.pP2) },
      max_demanded_kw: {
        p1: qrParams.pmaxP1 > 0 ? kw(qrParams.pmaxP1) : null,
        p2: qrParams.pmaxP2 > 0 ? kw(qrParams.pmaxP2) : null,
      },
      price_basis: getPowerPriceBasis(qrParams),
      by_period: powerPeriods.map((p) => ({
        period: p.period,
        label: p.label,
        contracted_kw: kw(p.power),
        price_eur_per_kw_day: price(p.pricePerDay),
        monthly_cost_eur: eur(p.monthlyCost),
      })),
    },
    consumption: {
      annual_kwh: {
        p1: qrParams.caP1,
        p2: qrParams.caP2,
        p3: qrParams.caP3,
        total: qrParams.caP1 + qrParams.caP2 + qrParams.caP3,
      },
      billing_period_kwh:
        billingTotal !== null
          ? {
              p1: qrParams.cfP1 ?? 0,
              p2: qrParams.cfP2 ?? 0,
              p3: qrParams.cfP3 ?? 0,
              total: billingTotal,
            }
          : null,
      annual_window_months: window.months,
      annual_window_source: window.source,
      annual_start: qrParams.iniA,
    },
    prices: {
      power_eur_per_kw_day: {
        p1: orNull(powerPeriods.find((p) => p.period === 'P1')?.pricePerDay),
        p2: orNull(powerPeriods.find((p) => p.period === 'P2')?.pricePerDay),
      },
      energy_eur_per_kwh: {
        p1: orNull(qrParams.prE1),
        p2: orNull(qrParams.prE2),
        p3: orNull(qrParams.prE3),
      },
    },
    invoice_amounts: {
      total_eur: split.total !== null ? eur(split.total) : null,
      power_eur: split.power !== null ? eur(split.power) : null,
      energy_eur: split.energy !== null ? eur(split.energy) : null,
      other_eur: split.other !== null ? eur(split.other) : null,
      percentages: split.percentages,
      social_bonus_eur: qrParams.impSA !== undefined ? eur(qrParams.impSA) : null,
      discount_eur: qrParams.dto !== undefined ? eur(qrParams.dto) : null,
      adjustment_eur: qrParams.ajuste !== undefined ? eur(qrParams.ajuste) : null,
      excess_power_eur: qrParams.exc !== undefined ? eur(qrParams.exc) : null,
      other_with_tax_eur: qrParams.impOtrosConIE !== undefined ? eur(qrParams.impOtrosConIE) : null,
      other_without_tax_eur:
        qrParams.impOtrosSinIE !== undefined ? eur(qrParams.impOtrosSinIE) : null,
    },
    monthly_estimate: {
      months_covered: window.months,
      energy_eur: eur(breakdown.monthlyEnergyCost),
      power_eur: eur(breakdown.monthlyPowerCost),
      subtotal_eur: eur(breakdown.subtotalElectricity),
      electricity_tax_eur: eur(breakdown.electricityTax),
      electricity_tax_rate: breakdown.electricityTaxRate,
      equipment_fee_eur: eur(breakdown.equipmentFee),
      iva_eur: eur(breakdown.iva),
      iva_rate: breakdown.ivaRate,
      total_eur: eur(breakdown.totalMonthlyCost),
      percentages: calculateBreakdownPercentages(breakdown),
      energy_by_period: breakdown.energyByPeriod.map((p) => ({
        period: p.period,
        consumption_kwh: p.consumption,
        price_eur_per_kwh: price(p.pricePerKwh),
        total_cost_eur: eur(p.totalCost),
      })),
    },
    invoice: qrParams,
  };

  return { ...base, inferences: buildInferences(qrParams, base, window) };
}

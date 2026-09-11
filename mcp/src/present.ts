/**
 * Shapes parsed CNMC data into the JSON an agent receives.
 *
 * Keys are English so the calling model reasons about them easily; every
 * human-readable string is Spanish so the agent can relay it to its user
 * verbatim.
 *
 * Two figures in here are inferences rather than facts printed on the invoice
 * (the power price basis and the annual consumption window). Both are reported
 * explicitly and both raise a warning when they are doing real work, so an agent
 * can qualify what it tells its user.
 */

import {
  ContractType,
  InvoiceType,
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
  getPermanenciaStatus,
  getPowerPriceBasis,
  getRevisionFrequencyLabel,
  isSinglePriceContract,
  resolveConsumptionMonths,
  splitInvoiceAmounts,
  formatCurrency,
  formatNumber,
  formatPower,
} from '../../src/lib/cnmc';

/** Round to cents, so JSON never carries floating-point noise. */
const eur = (value: number): number => Math.round(value * 100) / 100;

/** Round to a sensible precision for unit prices (€/kWh are quoted to 4 or 6 dp). */
const price = (value: number): number => Math.round(value * 1e6) / 1e6;

const kw = (value: number): number => Math.round(value * 1000) / 1000;

const orNull = (value: number | undefined): number | null =>
  value === undefined ? null : price(value);

const INVOICE_TYPE_LABELS: Record<string, string> = {
  [InvoiceType.CANCELLATION]: 'Anuladora',
  [InvoiceType.NORMAL]: 'Normal',
  [InvoiceType.CORRECTIVE]: 'Rectificadora',
  [InvoiceType.COMPLEMENTARY]: 'Complementaria',
  [InvoiceType.REGULARIZATION]: 'Regularizadora',
};

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
  summary_es: string;
  warnings: string[];
  /** The raw parsed QR fields, to pass back into the analysis tools. */
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
): { months: number; source: 'dates' | 'consumption' } => {
  const resolved = resolveConsumptionMonths(qrParams);
  const fromDates = calculateActualMonths(qrParams.iniA, qrParams.fFact || qrParams.finF);

  return {
    months: Math.round(resolved * 100) / 100,
    source: Math.abs(resolved - fromDates) < 0.01 ? 'dates' : 'consumption',
  };
};

const buildWarnings = (
  qrParams: QrParameters,
  report: Omit<InvoiceReport, 'warnings'>,
): string[] => {
  const warnings: string[] = [];

  if (report.consumption.annual_window_source === 'consumption') {
    warnings.push(
      `La fecha de inicio del consumo anual del QR (${qrParams.iniA}) no cuadra con el consumo ` +
        `facturado: implicaría un consumo mensual desproporcionado. Se ha estimado la ventana real ` +
        `en ${formatNumber(report.consumption.annual_window_months, 1)} meses a partir del ritmo de ` +
        `consumo del periodo facturado. Las medias mensuales son una estimación.`,
    );
  }

  if (report.power.price_basis === 'annual') {
    warnings.push(
      'Los precios de potencia del QR vienen en €/kW/año (habitual en tarifas indexadas) y se han ' +
        'convertido a €/kW/día dividiendo entre 365. El QR no indica la unidad, así que es una deducción.',
    );
  }

  if (report.power.price_basis === null) {
    warnings.push(
      'El QR no incluye precios de potencia, así que no se puede calcular el coste del término fijo ' +
        'ni el ahorro por bajar la potencia.',
    );
  }

  if (qrParams.prE1 === undefined) {
    warnings.push(
      'El QR no incluye precios de energía. La estimación mensual se ha derivado del importe total ' +
        'de la factura en lugar de calcularse a partir del consumo.',
    );
  }

  if (report.power.max_demanded_kw.p1 === null && report.power.max_demanded_kw.p2 === null) {
    warnings.push(
      'El QR no trae la potencia máxima demandada, así que no se puede saber si sobra potencia ' +
        'contratada. Ese dato está en el área de clientes de tu distribuidora.',
    );
  }

  if (report.billing_period.total_eur === null) {
    warnings.push('El QR no incluye el importe total de la factura.');
  }

  return warnings;
};

const buildSummary = (report: Omit<InvoiceReport, 'summary_es' | 'warnings'>): string => {
  const parts: string[] = [];

  const label = report.contract.label ?? 'de tipo desconocido';
  parts.push(
    `Tienes una tarifa ${label} con ${formatPower(report.power.contracted_kw.p1)} de potencia contratada en punta.`,
  );

  if (report.billing_period.total_eur !== null) {
    const days = report.billing_period.days;
    const period = days ? ` por un periodo de ${days} días` : '';
    parts.push(`Esta factura suma ${formatCurrency(report.billing_period.total_eur)}${period}.`);
  }

  if (report.invoice_amounts.power_eur !== null && report.invoice_amounts.energy_eur !== null) {
    parts.push(
      `De ese importe, ${formatCurrency(report.invoice_amounts.energy_eur)} son energía consumida ` +
        `y ${formatCurrency(report.invoice_amounts.power_eur)} el término fijo de potencia; el resto ` +
        `son impuestos, alquiler de contador y otros conceptos.`,
    );
  }

  parts.push(
    `La media mensual estimada, repartiendo tu consumo anual, es de ` +
      `${formatCurrency(report.monthly_estimate.total_eur)} al mes.`,
  );

  if (report.contract.penalty_active) {
    parts.push(`Ojo: tienes permanencia hasta el ${report.contract.penalty_end}.`);
  }

  return parts.join(' ');
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

  const billingTotal = (qrParams.cfP1 ?? 0) + (qrParams.cfP2 ?? 0) + (qrParams.cfP3 ?? 0) || null;

  const base: Omit<InvoiceReport, 'summary_es' | 'warnings'> = {
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
      invoice_type_label: qrParams.tf ? (INVOICE_TYPE_LABELS[qrParams.tf] ?? null) : null,
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

  const summary_es = buildSummary(base);
  const warnings = buildWarnings(qrParams, { ...base, summary_es });

  return { ...base, summary_es, warnings };
}

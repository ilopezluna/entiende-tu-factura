/**
 * Shapes the contracted-power analysis for an agent.
 *
 * The underlying verdict and arithmetic come from the shared power analysis; the
 * job here is to add the Spanish wording and the payback period, so an agent can
 * answer "¿puedo bajar la potencia?" without doing sums of its own.
 */

import {
  POWER_CHANGE_FEE_EUR,
  SAFETY_MARGIN,
  type PowerAnalysis,
  type PowerVerdict,
  type QrParameters,
  analyzePower,
  formatCurrency,
  formatNumber,
  formatPower,
  simulateAnnualSaving,
} from '../../src/lib/cnmc';

const eur = (value: number): number => Math.round(value * 100) / 100;
const kw = (value: number): number => Math.round(value * 1000) / 1000;

const VERDICT_LABELS: Record<PowerVerdict, string> = {
  'lower-possible': 'Puedes bajar la potencia contratada',
  keep: 'Mantén la potencia que tienes',
  tight: 'Tu potencia está justa: no la bajes',
  'no-data': 'No hay datos suficientes para decidir',
};

export interface PowerReport {
  verdict: PowerVerdict;
  verdict_label: string;
  verdict_es: string;
  safety_margin: number;
  has_max_demand: boolean;
  has_prices: boolean;
  periods: {
    period: string;
    label: string;
    contracted_kw: number;
    max_demanded_kw: number | null;
    recommended_kw: number | null;
    freed_kw: number;
    price_eur_per_kw_day: number | null;
    annual_saving_base_eur: number | null;
  }[];
  annual_saving: {
    base_eur: number;
    electricity_tax_eur: number;
    iva_eur: number;
    total_eur: number;
  } | null;
  change_fee_eur: number;
  payback_months: number | null;
  worth_it: boolean | null;
}

/** How long the one-off change fee takes to pay for itself. */
const paybackMonths = (annualSaving: number | null): number | null => {
  if (annualSaving === null || annualSaving <= 0) return null;
  return Math.round((POWER_CHANGE_FEE_EUR / (annualSaving / 12)) * 10) / 10;
};

const buildVerdictText = (analysis: PowerAnalysis, payback: number | null): string => {
  const { verdict, totalAnnualSaving } = analysis;

  if (verdict === 'no-data') {
    return (
      'Tu factura no incluye la potencia máxima que has demandado, así que no se puede saber si te ' +
      'sobra potencia contratada. Ese dato está en el área de clientes de tu distribuidora.'
    );
  }

  if (verdict === 'tight') {
    const tight = analysis.periods.filter(
      (p) => p.maxDemandKw !== null && p.maxDemandKw >= p.contractedKw,
    );
    const detail = tight
      .map((p) => `en ${p.label.toLowerCase()} llegaste a ${formatPower(p.maxDemandKw as number)}`)
      .join(' y ');
    return (
      `No bajes la potencia: ${detail}, es decir, has alcanzado o superado la que tienes contratada. ` +
      'Bajarla te haría saltar el diferencial.'
    );
  }

  if (verdict === 'keep') {
    return (
      'La potencia que tienes contratada ya se ajusta a lo que realmente usas, dejando un margen de ' +
      `seguridad del ${formatNumber(SAFETY_MARGIN * 100, 0)}%. No merece la pena tocarla.`
    );
  }

  const freed = analysis.periods.reduce((sum, p) => sum + p.freedKw, 0);
  const detail = analysis.periods
    .filter((p) => p.recommendedKw !== null && p.freedKw > 0)
    .map(
      (p) =>
        `${p.label.toLowerCase()} de ${formatPower(p.contractedKw)} a ${formatPower(p.recommendedKw as number)}`,
    )
    .join(' y ');

  if (!totalAnnualSaving) {
    return (
      `Puedes bajar ${formatPower(freed)} de potencia contratada (${detail}). Tu factura no trae los ` +
      'precios de potencia, así que no se puede calcular el ahorro exacto.'
    );
  }

  const paybackText =
    payback !== null && payback < 12
      ? ` El cambio cuesta ${formatCurrency(POWER_CHANGE_FEE_EUR)} una sola vez, así que lo recuperas en unos ${formatNumber(payback, 1)} meses.`
      : ` El cambio cuesta ${formatCurrency(POWER_CHANGE_FEE_EUR)} una sola vez.`;

  return (
    `Puedes bajar ${formatPower(freed)} de potencia contratada (${detail}) y ahorrar unos ` +
    `${formatCurrency(totalAnnualSaving.total)} al año con impuestos incluidos.${paybackText}`
  );
};

export function presentPower(qrParams: QrParameters): PowerReport {
  const analysis = analyzePower(qrParams);
  const saving = analysis.totalAnnualSaving;
  const payback = paybackMonths(saving ? saving.total : null);

  return {
    verdict: analysis.verdict,
    verdict_label: VERDICT_LABELS[analysis.verdict],
    verdict_es: buildVerdictText(analysis, payback),
    safety_margin: analysis.safetyMargin,
    has_max_demand: analysis.hasMaxDemand,
    has_prices: analysis.hasPrices,
    periods: analysis.periods.map((p) => ({
      period: p.period,
      label: p.label,
      contracted_kw: kw(p.contractedKw),
      max_demanded_kw: p.maxDemandKw === null ? null : kw(p.maxDemandKw),
      recommended_kw: p.recommendedKw === null ? null : kw(p.recommendedKw),
      freed_kw: kw(p.freedKw),
      price_eur_per_kw_day: p.pricePerDay === null ? null : Math.round(p.pricePerDay * 1e6) / 1e6,
      annual_saving_base_eur: p.annualSavingBase === null ? null : eur(p.annualSavingBase),
    })),
    annual_saving: saving
      ? {
          base_eur: eur(saving.base),
          electricity_tax_eur: eur(saving.electricityTax),
          iva_eur: eur(saving.iva),
          total_eur: eur(saving.total),
        }
      : null,
    change_fee_eur: POWER_CHANGE_FEE_EUR,
    payback_months: payback,
    worth_it: saving ? saving.total > POWER_CHANGE_FEE_EUR : null,
  };
}

export interface SimulationReport {
  proposed_kw: { p1: number; p2: number };
  annual_saving: {
    base_eur: number;
    electricity_tax_eur: number;
    iva_eur: number;
    total_eur: number;
  } | null;
  change_fee_eur: number;
  payback_months: number | null;
  summary_es: string;
  warnings: string[];
}

/**
 * Work out the annual saving for a specific pair of contracted powers, warning
 * when the proposal is below what the meter actually recorded.
 */
export function presentSimulation(
  qrParams: QrParameters,
  p1Kw: number,
  p2Kw: number,
): SimulationReport {
  const saving = simulateAnnualSaving(qrParams, { p1Kw, p2Kw });
  const payback = paybackMonths(saving ? saving.total : null);
  const warnings: string[] = [];

  const checks: { proposed: number; max: number; label: string }[] = [
    { proposed: p1Kw, max: qrParams.pmaxP1, label: 'punta (P1)' },
    { proposed: p2Kw, max: qrParams.pmaxP2, label: 'valle (P2)' },
  ];

  for (const { proposed, max, label } of checks) {
    if (max > 0 && proposed < max) {
      warnings.push(
        `En ${label} propones ${formatPower(proposed)}, por debajo de los ${formatPower(max)} que tu ` +
          'contador llegó a registrar. Con esa potencia te habría saltado el diferencial.',
      );
    } else if (max > 0 && proposed < max * (1 + SAFETY_MARGIN)) {
      warnings.push(
        `En ${label} propones ${formatPower(proposed)}, que deja menos del ` +
          `${formatNumber(SAFETY_MARGIN * 100, 0)}% de margen sobre tu máximo de ${formatPower(max)}.`,
      );
    }
  }

  if (p1Kw > qrParams.pP1 || p2Kw > qrParams.pP2) {
    warnings.push(
      'Estás proponiendo subir la potencia, no bajarla. El ahorro calculado será negativo o nulo, y ' +
        'subir potencia puede tener costes adicionales distintos de los derechos de enganche.',
    );
  }

  const summary_es = saving
    ? `Con ${formatPower(p1Kw)} en punta y ${formatPower(p2Kw)} en valle ahorrarías unos ` +
      `${formatCurrency(saving.total)} al año con impuestos incluidos.` +
      (payback !== null
        ? ` El cambio cuesta ${formatCurrency(POWER_CHANGE_FEE_EUR)} y lo recuperas en unos ${formatNumber(payback, 1)} meses.`
        : '')
    : 'Tu factura no trae los precios de potencia, así que no se puede calcular el ahorro.';

  return {
    proposed_kw: { p1: kw(p1Kw), p2: kw(p2Kw) },
    annual_saving: saving
      ? {
          base_eur: eur(saving.base),
          electricity_tax_eur: eur(saving.electricityTax),
          iva_eur: eur(saving.iva),
          total_eur: eur(saving.total),
        }
      : null,
    change_fee_eur: POWER_CHANGE_FEE_EUR,
    payback_months: payback,
    summary_es,
    warnings,
  };
}

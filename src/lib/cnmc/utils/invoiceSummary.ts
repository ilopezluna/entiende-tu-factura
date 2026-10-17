/**
 * Derived invoice figures.
 *
 * Pure functions over QrParameters: the per-category splits,
 * the billing period length and the permanence (permanencia) status. These used
 * to live inline in the result view; they are shared domain logic, so they live
 * here and are covered by tests.
 */

import { QrParameters } from '../types';
import { getInvoiceTypeFromTf, isRegularInvoice } from '../content/invoice';

const MS_PER_DAY = 86_400_000;

export interface BreakdownPercentages {
  energy: number;
  power: number;
  taxes: number;
}

/**
 * Length of the billing period in days, or null when the QR omits either bound
 * or carries an unparseable date.
 */
export const calculatePeriodDays = (qrParams: QrParameters): number | null => {
  if (!qrParams.iniF || !qrParams.finF) return null;

  const start = new Date(qrParams.iniF).getTime();
  const end = new Date(qrParams.finF).getTime();
  if (isNaN(start) || isNaN(end)) return null;

  const days = Math.round((end - start) / MS_PER_DAY);
  return days > 0 ? days : null;
};

export interface InvoiceAmountSplit {
  /** Total actually billed in this invoice, or null when the QR omits it. */
  total: number | null;
  /** Power term billed in this invoice, pre-tax. */
  power: number | null;
  /** Energy term billed in this invoice, pre-tax. */
  energy: number | null;
  /** Everything else up to the total: taxes, equipment rental, social bonus… */
  other: number | null;
  percentages: BreakdownPercentages;
}

/**
 * Per-category amounts billed in THIS invoice (as opposed to the averaged
 * monthly estimate). Power and energy come straight from the QR; the rest is
 * the remainder up to the total.
 */
export const splitInvoiceAmounts = (qrParams: QrParameters): InvoiceAmountSplit => {
  const total = qrParams.imp && qrParams.imp > 0 ? qrParams.imp : null;
  const power = qrParams.impPot > 0 ? qrParams.impPot : null;
  const energy = qrParams.impEner && qrParams.impEner > 0 ? qrParams.impEner : null;
  const other =
    total !== null ? Math.max(total - (qrParams.impPot || 0) - (qrParams.impEner || 0), 0) : null;

  const pct = (value: number | null) =>
    total !== null && value !== null ? Math.round((value / total) * 100) : 0;

  return {
    total,
    power,
    energy,
    other,
    percentages: { energy: pct(energy), power: pct(power), taxes: pct(other) },
  };
};

export interface PermanenciaStatus {
  /** Penalty end date as an ISO day (YYYY-MM-DD). */
  endDate: string;
  /** True while the penalty period has not yet elapsed. */
  isActive: boolean;
}

/**
 * Average cost per day of this invoice: total with taxes divided by the
 * billing period length. Null when the QR omits the total or the period, when
 * either is not positive, or when the invoice is not a normal period's bill —
 * complementary, regularization and cancellation invoices adjust earlier
 * bills, so their totals are not a period's cost to divide out.
 */
export const getCostPerDay = (qrParams: QrParameters): number | null => {
  if (!isRegularInvoice(getInvoiceTypeFromTf(qrParams.tf))) return null;
  const days = calculatePeriodDays(qrParams);
  const total = qrParams.imp;
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0 || days === null) {
    return null;
  }
  return total / days;
};

/**
 * Permanence penalty status, or null when the QR carries no end date or the
 * '0000-00-00' sentinel some retailers use for "no penalty".
 *
 * @param now - injectable clock so callers and tests are deterministic.
 */ export const getPermanenciaStatus = (
  qrParams: QrParameters,
  now: Date = new Date(),
): PermanenciaStatus | null => {
  const finPen = qrParams.finPen;
  if (!finPen || finPen === '0000-00-00') return null;

  const endDate = new Date(finPen + 'T00:00:00');
  if (isNaN(endDate.getTime())) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return {
    endDate: finPen,
    isActive: endDate > today,
  };
};

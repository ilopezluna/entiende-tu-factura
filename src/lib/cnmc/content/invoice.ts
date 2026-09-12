/**
 * Invoice types: the `tf` parameter of the CNMC QR.
 *
 * Reference: BOE Resolution of 6 October 2022, Annex I, Table 2.
 * https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-16989
 *
 * Kept here rather than next to whoever renders it, so the web app and the MCP
 * server say the same thing. The type matters more than it looks: on anything
 * other than a normal invoice the amounts do not mean what they usually mean.
 */

import { InvoiceType } from '../types';

export function getInvoiceTypeFromTf(tf: string | undefined): InvoiceType | null {
  if (!tf) return null;
  const code = tf.charAt(0).toUpperCase();
  const values = Object.values(InvoiceType) as string[];
  return values.includes(code) ? (code as InvoiceType) : null;
}

export function getInvoiceTypeLabel(type: InvoiceType): string {
  const labels: Record<InvoiceType, string> = {
    [InvoiceType.CANCELLATION]: 'Anuladora',
    [InvoiceType.NORMAL]: 'Normal',
    [InvoiceType.CORRECTIVE]: 'Rectificadora',
    [InvoiceType.COMPLEMENTARY]: 'Complementaria',
    [InvoiceType.REGULARIZATION]: 'Regularizadora',
  };
  return labels[type];
}

export function getInvoiceTypeExplanation(type: InvoiceType): string {
  const explanations: Record<InvoiceType, string> = {
    [InvoiceType.CANCELLATION]:
      'Anula una factura que no debería haberse emitido. Los importes no son lo que pagas: deshacen un cobro anterior.',
    [InvoiceType.NORMAL]: 'Una factura corriente del periodo. Es el caso habitual.',
    [InvoiceType.CORRECTIVE]:
      'Sustituye a otra factura del mismo periodo, normalmente porque había un error en la energía facturada o en otros conceptos. La que reemplaza deja de valer.',
    [InvoiceType.COMPLEMENTARY]:
      'Complementa a otra factura que no se anula, por un registro incorrecto de la medida. Solo se usa en casos de anomalías y fraude.',
    [InvoiceType.REGULARIZATION]:
      'Modifica una o varias facturas ya emitidas sin anularlas. Suele aparecer al ajustar estimaciones contra lecturas reales.',
  };
  return explanations[type];
}

/**
 * Whether the figures on this invoice can be read as a normal period's costs.
 *
 * Everything except a normal invoice adjusts earlier ones, so totals and
 * consumption are not a month of supply and should not be averaged as if they
 * were.
 */
export const isRegularInvoice = (type: InvoiceType | null): boolean =>
  type === null || type === InvoiceType.NORMAL;

/**
 * Dictionary of the CNMC invoice QR fields.
 *
 * Reference: BOE Resolution of 6 October 2022 (Table 1, pages 11-15).
 *
 * Typed as `Record<keyof QrParameters, QrFieldDoc>`, so adding a field to
 * QrParameters without documenting it here is a compile error. That is what
 * keeps this dictionary from drifting away from the type it describes.
 */

import type { QrParameters } from '../types';

/** Unit a field is expressed in, or null for codes, dates and flags. */
export type QrFieldUnit = 'kW' | 'kWh' | '€' | '€/kWh' | '€/kW día' | null;

export interface QrFieldDoc {
  /** Spanish name as used on the invoice. */
  name: string;
  unit: QrFieldUnit;
  /** Whether the CNMC spec makes the field mandatory. */
  required: boolean;
  /** Any extra semantics worth knowing when reading the value. */
  notes?: string;
}

export const QR_FIELDS: Record<keyof QrParameters, QrFieldDoc> = {
  // Basic information
  cp: { name: 'Código postal', unit: null, required: true },
  cups: {
    name: 'CUPS: Código Universal del Punto de Suministro',
    unit: null,
    required: true,
    notes: 'Identifica el punto de suministro. No cambia al cambiar de comercializadora.',
  },
  com: {
    name: 'Comercializadora',
    unit: null,
    required: true,
    notes: 'Código con formato R2-XXX.',
  },

  // Contracted power
  pP1: { name: 'Potencia contratada en P1 (punta)', unit: 'kW', required: true },
  pP2: { name: 'Potencia contratada en P2 (valle)', unit: 'kW', required: true },

  // Maximum power demand
  pmaxP1: {
    name: 'Potencia máxima demandada en P1 en el último año',
    unit: 'kW',
    required: true,
    notes: 'Clave para saber si sobra potencia contratada.',
  },
  pmaxP2: {
    name: 'Potencia máxima demandada en P2 en el último año',
    unit: 'kW',
    required: true,
    notes: 'Clave para saber si sobra potencia contratada.',
  },

  // Annual consumption
  caP1: { name: 'Consumo del último año en P1', unit: 'kWh', required: true },
  caP2: { name: 'Consumo del último año en P2', unit: 'kWh', required: true },
  caP3: { name: 'Consumo del último año en P3', unit: 'kWh', required: true },

  // Billing period consumption
  cfP1: { name: 'Consumo del periodo facturado en P1', unit: 'kWh', required: false },
  cfP2: { name: 'Consumo del periodo facturado en P2', unit: 'kWh', required: false },
  cfP3: { name: 'Consumo del periodo facturado en P3', unit: 'kWh', required: false },

  // Dates
  iniA: {
    name: 'Fecha de inicio del consumo anual',
    unit: null,
    required: true,
    notes: 'YYYY-MM-DD. El día indicado NO se incluye. Algunas comercializadoras lo rellenan mal.',
  },
  iniF: {
    name: 'Fecha de inicio del periodo de facturación',
    unit: null,
    required: false,
    notes: 'YYYY-MM-DD. El día indicado NO se incluye.',
  },
  finF: {
    name: 'Fecha de fin del periodo de facturación',
    unit: null,
    required: false,
    notes: 'YYYY-MM-DD, incluida.',
  },
  fFact: { name: 'Fecha de emisión de la factura', unit: null, required: false },
  finContrato: { name: 'Fecha de fin de contrato', unit: null, required: false },
  finPen: {
    name: 'Fecha de fin de permanencia',
    unit: null,
    required: false,
    notes: "Algunas comercializadoras usan '0000-00-00' para indicar que no hay permanencia.",
  },

  // Contract type
  tc: {
    name: 'Tipo de contrato',
    unit: null,
    required: true,
    notes:
      'Dos caracteres: el primero es el tipo (A PVPC, B indexada horaria, C indexada precio único, ' +
      'D indexada 3 periodos, E fija 3 periodos, F fija precio único, G flexible, H tarifa plana) y ' +
      'el segundo indica si hay cuota fija mensual.',
  },
  tf: {
    name: 'Tipo de factura',
    unit: null,
    required: false,
    notes: 'A anuladora, N normal, R rectificadora, C complementaria, G regularizadora.',
  },

  // Prices
  prP1: {
    name: 'Precio del término de potencia en P1, sin impuestos',
    unit: '€/kW día',
    required: false,
    notes: 'En tarifas indexadas (A0) puede venir en €/kW año; el QR no lo indica.',
  },
  prP2: {
    name: 'Precio del término de potencia en P2, sin impuestos',
    unit: '€/kW día',
    required: false,
    notes: 'En tarifas indexadas (A0) puede venir en €/kW año; el QR no lo indica.',
  },
  prE1: {
    name: 'Precio del término de energía en P1, sin impuestos',
    unit: '€/kWh',
    required: false,
  },
  prE2: {
    name: 'Precio del término de energía en P2, sin impuestos',
    unit: '€/kWh',
    required: false,
  },
  prE3: {
    name: 'Precio del término de energía en P3, sin impuestos',
    unit: '€/kWh',
    required: false,
  },

  // Invoice amounts
  imp: { name: 'Importe total de la factura, con impuestos', unit: '€', required: false },
  impPot: { name: 'Subtotal del término de potencia, sin impuestos', unit: '€', required: true },
  impEner: {
    name: 'Subtotal del término de energía, sin impuestos',
    unit: '€',
    required: false,
    notes: 'En tarifa plana o cuota fija mensual, ese importe.',
  },
  impSA: { name: 'Subtotal de servicios adicionales, sin impuestos', unit: '€', required: false },
  impOtrosConIE: {
    name: 'Otros conceptos con impuesto eléctrico, sin impuestos',
    unit: '€',
    required: false,
  },
  impOtrosSinIE: {
    name: 'Otros conceptos sin impuesto eléctrico, sin impuestos',
    unit: '€',
    required: false,
  },
  dto: {
    name: 'Descuentos no incluidos en potencia o energía, sin impuestos',
    unit: '€',
    required: false,
  },

  // Special concepts
  exc: {
    name: 'Compensación de excedentes de autoconsumo o descuento por retardo',
    unit: '€',
    required: false,
  },
  dtoBS: { name: 'Descuento del bono social, sin impuestos', unit: '€', required: false },
  finBS: {
    name: 'Financiación del bono social, sin impuestos',
    unit: '€',
    required: false,
    notes: '-1 en PVPC, 0 si no aplica.',
  },
  ajuste: {
    name: 'Mecanismo de ajuste (RD-l 10/2022), sin impuestos',
    unit: '€',
    required: false,
    notes: '-1 en PVPC, 0 si no aplica.',
  },

  // Flexible tariff consumption
  cfP1flex: { name: 'Consumo en la franja 1 de tarifas flexibles', unit: 'kWh', required: false },
  cfP2flex: { name: 'Consumo en la franja 2 de tarifas flexibles', unit: 'kWh', required: false },

  // Flags
  cambio: {
    name: 'Cambio de precios',
    unit: null,
    required: false,
    notes: '0 sin cambio, 1 en el periodo actual, 2 en el siguiente.',
  },
  promo: {
    name: 'Promoción',
    unit: null,
    required: false,
    notes: '1 si la factura lleva promoción no permanente.',
  },
  verde: {
    name: 'Energía verde',
    unit: null,
    required: false,
    notes: '1 si el contrato es verde.',
  },
  rev: {
    name: 'Revisión de precios',
    unit: null,
    required: false,
    notes: '0 anual, 1 semestral, 2 trimestral, 3 mensual, 4 cada 3 años, 5 cada 5 años.',
  },
};

/** Documentation for one QR field, or null when the name is not a known field. */
export const getQrField = (field: string): QrFieldDoc | null =>
  (QR_FIELDS as Record<string, QrFieldDoc>)[field] ?? null;

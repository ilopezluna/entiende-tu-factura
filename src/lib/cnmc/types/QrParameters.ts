/**
 * QR Parameters interface based on CNMC specification
 * Reference: BOE Resolution of October 6, 2022 (Table 1, pages 11-15)
 */
export interface QrParameters {
  // Basic information
  cp: string; // Código postal (Postal code)
  cups: string; // CUPS (Universal Supply Point Code)
  com: string; // Comercializador (Supplier code: R2-XXX)

  // Contracted power (Potencia contratada)
  pP1: number; // Potencia del contrato de acceso en P1, en kW
  pP2: number; // Potencia del contrato de acceso en P2, en kW

  // Maximum power demand (Potencia máxima demandada)
  pmaxP1: number; // Potencia máxima demanda en el último año en P1, en kW
  pmaxP2: number; // Potencia máxima demanda en el último año en P2, en kW

  // Annual consumption (Consumo anual)
  caP1: number; // Consumo del último año en P1, en kWh
  caP2: number; // Consumo del último año en P2, en kWh
  caP3: number; // Consumo del último año en P3, en kWh

  // Billing period consumption (Consumo del periodo de facturación) - Optional
  cfP1?: number; // Consumo del periodo de facturación en P1, en kWh
  cfP2?: number; // Consumo del periodo de facturación en P2, en kWh
  cfP3?: number; // Consumo del periodo de facturación en P3, en kWh

  // Dates
  iniA: string; // Fecha inicio correspondiente al consumo anual (YYYY-MM-DD, NOT included)
  iniF?: string; // Fecha inicio del periodo de facturación (YYYY-MM-DD, NOT included)
  finF?: string; // Fecha fin del periodo de facturación (YYYY-MM-DD, included)
  fFact?: string; // Fecha de emisión de la factura (YYYY-MM-DD)
  finContrato?: string; // Fecha fin contrato (YYYY-MM-DD)
  finPen?: string; // Fecha fin permanencia (YYYY-MM-DD)

  // Contract type
  tc: string; // Tipo de contrato (2 characters: type + fixed monthly fee flag)
  tf?: string; // Tipo de factura (A: Anuladora, N: Normal, R: Rectificadora, C: Complementaria, G: Regularizadora)

  // Prices
  prP1?: number; // Precio del término de potencia en P1, sin impuestos (€/kW día)
  prP2?: number; // Precio del término de potencia en P2, sin impuestos (€/kW día)
  prE1?: number; // Precio del término de energía en P1, sin impuestos (€/kWh)
  prE2?: number; // Precio del término de energía en P2, sin impuestos (€/kWh)
  prE3?: number; // Precio del término de energía en P3, sin impuestos (€/kWh)

  // Invoice amounts (without taxes)
  imp?: number; // Importe total de la factura, con impuestos (€)
  impPot: number; // Subtotal del término de potencia, sin impuestos (€)
  impEner?: number; // Subtotal del término de energía/tarifa plana/cuota mensual fija, sin impuestos (€)
  impSA?: number; // Subtotal de servicios adicionales, sin impuestos (€)
  impOtrosConIE?: number; // Subtotal de otros conceptos con Impuesto de Electricidad, sin impuestos (€)
  impOtrosSinIE?: number; // Subtotal de otros conceptos sin Impuesto de Electricidad, sin impuestos (€)
  dto?: number; // Subtotal de descuentos no incluidos en términos de potencia o energía, sin impuestos (€)

  // Special concepts
  exc?: number; // Compensación de excedentes de autoconsumo o descuento por retardo, sin impuestos (€)
  dtoBS?: number; // Descuento del bono social, sin impuestos (€)
  finBS?: number; // Financiación del bono social, sin impuestos (€) (-1 for PVPC, 0 if not applicable)
  ajuste?: number; // Mecanismo de ajuste (RD-l 10/2022), sin impuestos (€) (-1 for PVPC, 0 if not applicable)

  // Flexible tariff consumption (only for flexible tariffs)
  cfP1flex?: number; // Consumo en franja horaria 1 de tarifas flexibles, en kWh
  cfP2flex?: number; // Consumo en franja horaria 2 de tarifas flexibles, en kWh

  // Flags
  cambio?: number; // Cambio de precios (0: no change, 1: in current period, 2: in next period)
  promo?: number; // Promoción (1: if invoice includes a non-permanent promotion)
  verde?: number; // Energía verde (1: if contract is "green")
  rev?: number; // Revisión de precios (0: annual, 1: biannual, 2: quarterly, 3: monthly, 4: every 3 years, 5: every 5 years)
}

/**
 * Contract type codes (first character of 'tc' parameter)
 */
export enum ContractType {
  PVPC = 'A', // PVPC
  INDEXED_HOURLY = 'B', // Indexed with hourly prices
  INDEXED_SINGLE = 'C', // Indexed with single price
  INDEXED_3PERIODS = 'D', // Indexed with 3 periods (matching 2.0TD)
  FIXED_3PERIODS = 'E', // Fixed with 3 periods (matching 2.0TD)
  FIXED_SINGLE = 'F', // Fixed with single price for all hours
  FLEXIBLE = 'G', // Flexible tariff
  FLAT_RATE = 'H', // Flat rate tariff
}

/**
 * Invoice type codes ('tf' parameter)
 */
export enum InvoiceType {
  CANCELLATION = 'A', // Anuladora
  NORMAL = 'N', // Normal
  CORRECTIVE = 'R', // Rectificadora
  COMPLEMENTARY = 'C', // Complementaria
  REGULARIZATION = 'G', // Regularizadora
}

/**
 * Price revision frequency ('rev' parameter)
 */
export enum PriceRevisionFrequency {
  ANNUAL = 0,
  BIANNUAL = 1,
  QUARTERLY = 2,
  MONTHLY = 3,
  EVERY_3_YEARS = 4,
  EVERY_5_YEARS = 5,
}

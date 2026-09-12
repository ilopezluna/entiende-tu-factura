/**
 * Read-only reference material the server exposes as MCP resources.
 *
 * These let an agent reason about the CNMC invoice format itself, not just run a
 * tool over one file. That division of labour is the design of this server: it
 * extracts the data and says what each field means, and the agent does the
 * arithmetic with the recipes published here.
 */

import {
  CONCEPT_IDS,
  ContractType,
  InvoiceType,
  DAYS_PER_YEAR,
  ELECTRICITY_TAX_RATE,
  GLOSSARY,
  IVA_RATE,
  MIN_RECOMMENDED_POWER_KW,
  POWER_CHANGE_FEE_EUR,
  POWER_STEP_KW,
  QR_FIELDS,
  SAFETY_MARGIN,
  getContractTypeCategory,
  getContractTypeExplanation,
  getContractTypeLabel,
  getInvoiceTypeExplanation,
  getInvoiceTypeLabel,
  isSinglePriceContract,
} from '../../src/lib/cnmc';

export const CONTRACT_TYPE_IDS = Object.values(ContractType);

export const BOE_URL = 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-16989';

/**
 * The worked example from Annex I, reproduced as printed.
 *
 * It is quoted verbatim on purpose, defect included: the URL in the official
 * document lost the decimal separator of prP1 and prP2, which Table 4 of that
 * same annex gives as 26.164043 and 1.143132. An agent that used it as a
 * reference for parsing would read two nonsensical prices, so the corrected form
 * is published next to it and `resources.test.ts` pins both.
 */
export const SPEC_EXAMPLE_URL_AS_PRINTED =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=28001&pP1=3.3&pP2=3.3&caP1=1298&caP2=1189' +
  '&caP3=2178&iniA=2021-09-03&tc=E0&finContrato=2023-06-30&tf=N&imp=151.62&cfP1=112&cfP2=94' +
  '&cfP3=180&iniF=2022-07-31&finF=2022-08-31&impSA=5.50&impOtrosConIE=0&impOtrosSinIE=0.83' +
  '&com=R2-000&cups=ES0000000002054081TS&pmaxP1=3.0&pmaxP2=3.3&fFact=2022-09-05&finBS=1.14' +
  '&ajuste=65.40&impPot=7.65&impEner=85.18&prP1=26164043&prP2=1143132&prE1=0.263547' +
  '&prE2=0.215858&prE3=0.196532&verde=1';

export const SPEC_EXAMPLE_URL_CORRECTED = SPEC_EXAMPLE_URL_AS_PRINTED.replace(
  'prP1=26164043&prP2=1143132',
  'prP1=26.164043&prP2=1.143132',
);

export const qrFieldsResource = () => ({
  source: 'Resolución de la CNMC de 6 de octubre de 2022, Anexo I, Tabla 1',
  source_url: BOE_URL,
  description:
    'Campos codificados en el QR de las facturas eléctricas españolas. La URL del QR tiene la forma ' +
    'https://comparador.cnmc.gob.es/comparador/QRE?<campo>=<valor>&...',
  required_means:
    'required: true son los campos con la casilla «Obligatorio» marcada en la Tabla 1, presentes en ' +
    'toda factura. required: false NO quiere decir opcional: la mayoría son obligatorios salvo en ' +
    'facturas anuladoras, rectificadoras, complementarias o regularizadoras. Que falte uno es algo ' +
    'que merece mencionarse, no lo normal.',
  fields: Object.entries(QR_FIELDS).map(([field, doc]) => ({ field, ...doc })),
  invoice_types: {
    field: 'tf',
    source: 'Anexo I, Tabla 2',
    note:
      'Salvo en las normales, los importes ajustan facturas anteriores: no son el coste de un ' +
      'periodo de suministro y no se deben promediar como tal.',
    types: (Object.values(InvoiceType) as InvoiceType[]).map((code) => ({
      code,
      label: getInvoiceTypeLabel(code),
      explanation: getInvoiceTypeExplanation(code),
    })),
  },
  example: {
    source: 'Anexo I, Tabla 4',
    description:
      'El ejemplo resuelto de la Resolución, para ver la forma de una URL completa con todos los ' +
      'parámetros.',
    url_as_printed: SPEC_EXAMPLE_URL_AS_PRINTED,
    url_corrected: SPEC_EXAMPLE_URL_CORRECTED,
    known_defect:
      'La URL publicada en el BOE perdió el separador decimal de prP1 y prP2. La Tabla 4 de ese ' +
      'mismo anexo les da los valores 26,164043 y 1,143132. Usa url_corrected si necesitas un ' +
      'ejemplo que se pueda parsear; url_as_printed queda para poder contrastar con la fuente.',
  },
});

export const glossaryResource = () => ({
  description:
    'Conceptos de una factura de la luz española, explicados en lenguaje llano y enlazados a los ' +
    'campos del QR que los describen.',
  concepts: CONCEPT_IDS.map((id) => GLOSSARY[id]),
});

/**
 * The method for deciding whether the contracted power can be lowered.
 *
 * This server does not do that arithmetic: `read_invoice` returns the inputs and
 * the agent works out the answer. But the margin, the rounding rule and the tax
 * order are conventions it could not guess, and the website applies them to show
 * the same figures, so they are published here rather than left to chance.
 *
 * Every number is imported from the shared modules the web app uses, never
 * written out by hand, so the resource cannot drift away from what the website
 * shows. `resources.test.ts` guards both that and the worked example.
 */
export const powerMethodResource = () => ({
  description:
    'Método para decidir si se puede bajar la potencia contratada y cuánto se ahorraría al año. ' +
    'Es el mismo cálculo que aplica la web del proyecto, así que siguiéndolo al pie de la letra ' +
    'obtienes las cifras que vería el usuario allí.',
  inputs:
    'Todo lo que hace falta lo devuelve read_invoice: power.contracted_kw, power.max_demanded_kw ' +
    'y prices.power_eur_per_kw_day, más monthly_estimate.electricity_tax_rate e ' +
    'monthly_estimate.iva_rate.',
  constants: {
    safety_margin: SAFETY_MARGIN,
    power_step_kw: POWER_STEP_KW,
    min_recommended_power_kw: MIN_RECOMMENDED_POWER_KW,
    days_per_year: DAYS_PER_YEAR,
    change_fee_eur: POWER_CHANGE_FEE_EUR,
    electricity_tax_rate: ELECTRICITY_TAX_RATE,
    iva_rate: IVA_RATE,
  },
  recommended_power: {
    description: 'Potencia recomendada, por separado para P1 (punta) y P2 (valle).',
    steps: [
      'Parte de max_demanded_kw del periodo. Si es null o 0, no hay recomendación para ese periodo.',
      `Multiplica por 1 + safety_margin (${SAFETY_MARGIN * 100}% de margen sobre el pico registrado).`,
      `Redondea hacia ARRIBA a múltiplos de ${POWER_STEP_KW} kW, que es el escalón en el que se ` +
        'contrata la potencia en suministros de hasta 15 kW.',
      `Aplica un suelo de ${MIN_RECOMMENDED_POWER_KW} kW.`,
      'Topa el resultado en la potencia que ya tiene contratada: la recomendación nunca sube.',
      'Los kW liberados son contracted_kw menos la recomendada, redondeado a 1 decimal porque ' +
        'ambas cifras son múltiplos de 0,1 kW, y nunca negativo. Sin ese redondeo arrastras un ' +
        'error de coma flotante que te cambia el ahorro en un céntimo.',
    ],
    note:
      'El redondeo es hacia arriba, no al más cercano: 3,41 kW se contrata como 3,5 kW, no como ' +
      '3,4 kW. Redondear a la baja dejaría al usuario por debajo de su propio pico.',
  },
  annual_saving: {
    description: 'Ahorro anual de bajar la potencia, con impuestos.',
    steps: [
      'Por periodo: kW liberados x price_eur_per_kw_day x days_per_year. Sin precio para ese ' +
        'periodo, no se puede calcular y se omite.',
      'Suma los periodos para obtener la base imponible.',
      'Impuesto eléctrico = base x electricity_tax_rate.',
      'IVA = (base + impuesto eléctrico) x iva_rate. OJO: en cascada, sobre base más impuesto, ' +
        'no sobre la base sola.',
      'Total = base + impuesto eléctrico + IVA.',
    ],
    note:
      `Son ${DAYS_PER_YEAR} días, no 360 ni 365,25: es el mismo divisor con el que read_invoice ` +
      'normaliza a €/kW/día un precio que venga en €/kW/año, así que usar otro descuadraría las ' +
      'dos cifras entre sí.',
  },
  verdict: {
    description:
      'Los cuatro desenlaces posibles, evaluados en este orden. El caso "tight" es el importante: ' +
      'evita recomendar una bajada que haría saltar el diferencial.',
    states: [
      {
        id: 'no-data',
        rule: 'Ningún periodo trae potencia máxima demandada.',
        meaning:
          'No se puede decidir. Ese dato está en el área de clientes de la distribuidora, no en ' +
          'la factura.',
      },
      {
        id: 'tight',
        rule: 'En algún periodo la máxima demandada alcanza o supera la contratada.',
        meaning:
          'No bajar la potencia bajo ningún concepto. El usuario ya ha llegado a su límite y ' +
          'bajarla le haría saltar el diferencial.',
      },
      {
        id: 'lower-possible',
        rule: `Los kW liberados suman al menos un escalón de ${POWER_STEP_KW} kW.`,
        meaning: 'Se puede bajar. Da la recomendación, el ahorro anual y la amortización.',
      },
      {
        id: 'keep',
        rule: 'Hay datos y no sobra ni un escalón.',
        meaning: 'La potencia contratada ya se ajusta al consumo real. No merece la pena tocarla.',
      },
    ],
  },
  change_fee: {
    amount_eur: POWER_CHANGE_FEE_EUR,
    description:
      `Bajar la potencia cuesta ${POWER_CHANGE_FEE_EUR} € una sola vez (derechos de enganche más ` +
      'IVA) y solo se puede hacer una vez cada doce meses.',
    payback_months: 'change_fee_eur / (ahorro anual total / 12).',
    worth_it: 'El cambio compensa cuando el ahorro anual total supera change_fee_eur.',
  },
  worked_example: {
    description:
      'Ejemplo completo para autocomprobación. Si aplicando el método a estos datos no te salen ' +
      'estas cifras, repasa el redondeo y el orden de los impuestos antes de responder al usuario.',
    given: {
      contracted_kw: { p1: 4.6, p2: 4.6 },
      max_demanded_kw: { p1: 2.8, p2: 3.1 },
      power_eur_per_kw_day: { p1: 0.1, p2: 0.05 },
    },
    expected: {
      recommended_kw: { p1: 3.1, p2: 3.5 },
      freed_kw: { p1: 1.5, p2: 1.1 },
      annual_saving_base_eur: { p1: 54.75, p2: 20.08 },
      base_eur: 74.83,
      total_eur: 95.17,
      payback_months: 1.4,
      verdict: 'lower-possible',
    },
  },
});

export const contractTypeTable = () => ({
  description:
    'Tipos de contrato que puede codificar el campo tc del QR. El primer carácter de tc es el código.',
  types: CONTRACT_TYPE_IDS.map((code) => ({
    code,
    label: getContractTypeLabel(code),
    explanation: getContractTypeExplanation(code),
    category: getContractTypeCategory(code),
    single_price: isSinglePriceContract(code),
  })),
});

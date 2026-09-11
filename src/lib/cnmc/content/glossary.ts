/**
 * Glossary of Spanish electricity invoice concepts.
 *
 * Plain-language explanations keyed by concept id, each pointing at the
 * QrParameters fields it describes. Shared by the web app and by non-browser
 * consumers so that both explain an invoice the same way.
 *
 * Rates are interpolated from the calculation modules rather than restated in
 * prose, so the copy cannot drift away from the arithmetic.
 */

import { ELECTRICITY_TAX_RATE, IVA_RATE } from '../utils/costCalculations';
import { POWER_CHANGE_FEE_EUR, SAFETY_MARGIN } from '../utils/powerAnalysis';
import { formatPercentage, formatCurrency } from '../format';
import type { QrParameters } from '../types';

export type ConceptId =
  | 'termino_potencia'
  | 'termino_energia'
  | 'periodos_p1_p2_p3'
  | 'impuesto_electricidad'
  | 'iva'
  | 'alquiler_contador'
  | 'bono_social'
  | 'potencia_maxima_demandada'
  | 'permanencia'
  | 'cups'
  | 'tipo_contrato'
  | 'revision_precios'
  | 'cambio_potencia'
  | 'consumo_anual';

export interface Concept {
  id: ConceptId;
  /** Short Spanish title, suitable as a heading. */
  title: string;
  /** Plain-language Spanish explanation, safe to relay verbatim to a user. */
  explanation: string;
  /** QrParameters fields this concept describes. */
  fields: (keyof QrParameters)[];
}

export const GLOSSARY: Record<ConceptId, Concept> = {
  termino_potencia: {
    id: 'termino_potencia',
    title: 'Término de potencia',
    explanation:
      'El coste fijo por tener la luz disponible en tu casa. Se paga por cada kW contratado y por cada día del periodo, consumas o no consumas. Es como el alquiler mensual de unas tuberías más o menos anchas: pagas por tenerlas ahí listas, no por el agua que pasa.',
    fields: ['pP1', 'pP2', 'prP1', 'prP2', 'impPot'],
  },
  termino_energia: {
    id: 'termino_energia',
    title: 'Término de energía',
    explanation:
      'Lo que cuesta generar la electricidad que realmente usas. Se paga por cada kWh consumido, al precio que marque tu contrato en cada tramo horario.',
    fields: ['caP1', 'caP2', 'caP3', 'cfP1', 'cfP2', 'cfP3', 'prE1', 'prE2', 'prE3', 'impEner'],
  },
  periodos_p1_p2_p3: {
    id: 'periodos_p1_p2_p3',
    title: 'Periodos horarios P1, P2 y P3',
    explanation:
      'La tarifa doméstica 2.0TD divide el día en tres tramos: P1 punta (el más caro), P2 llano y P3 valle (el más barato). Los fines de semana y festivos nacionales son valle las 24 horas. Para la potencia contratada solo hay dos tramos: P1 punta y P2 valle.',
    fields: ['caP1', 'caP2', 'caP3', 'prE1', 'prE2', 'prE3', 'pP1', 'pP2'],
  },
  impuesto_electricidad: {
    id: 'impuesto_electricidad',
    title: 'Impuesto eléctrico',
    explanation: `Un impuesto especial que se aplica sobre la suma de potencia y energía, al ${formatPercentage(ELECTRICITY_TAX_RATE * 100, 2)}. No depende de tu comercializadora: lo paga todo el mundo.`,
    fields: [],
  },
  iva: {
    id: 'iva',
    title: 'IVA',
    explanation: `El ${formatPercentage(IVA_RATE * 100)} se aplica al final, sobre todo lo anterior. Incluido el impuesto eléctrico: sí, es un impuesto sobre otro impuesto.`,
    fields: [],
  },
  alquiler_contador: {
    id: 'alquiler_contador',
    title: 'Alquiler del contador',
    explanation:
      'Una cuota fija mensual por el equipo de medida, salvo que el contador sea de tu propiedad. Es un importe pequeño y regulado, igual para todas las comercializadoras.',
    fields: [],
  },
  bono_social: {
    id: 'bono_social',
    title: 'Bono social',
    explanation:
      'Descuento regulado sobre la factura para hogares vulnerables. Se solicita a la comercializadora de referencia y hay que renovarlo periódicamente. Si aparece un importe aquí, ya lo tienes aplicado.',
    fields: ['impSA', 'dtoBS', 'finBS'],
  },
  potencia_maxima_demandada: {
    id: 'potencia_maxima_demandada',
    title: 'Potencia máxima demandada',
    explanation: `El pico de potencia que tu contador ha registrado en el periodo. Es el dato clave para saber si puedes bajar la potencia contratada: si tu máximo está muy por debajo de lo que pagas, estás pagando de más. Se recomienda dejar un margen de seguridad del ${formatPercentage(SAFETY_MARGIN * 100)} por encima de ese máximo.`,
    fields: ['pmaxP1', 'pmaxP2', 'pP1', 'pP2'],
  },
  permanencia: {
    id: 'permanencia',
    title: 'Permanencia',
    explanation:
      'La fecha hasta la que estás atado al contrato. Si te cambias de comercializadora antes, puedes tener penalización. Cambiar de compañía es gratis y no te cortan la luz, pero conviene mirar esta fecha primero.',
    fields: ['finPen', 'finContrato'],
  },
  cups: {
    id: 'cups',
    title: 'CUPS',
    explanation:
      'El Código Universal del Punto de Suministro: el identificador único de tu enganche a la red. No cambia aunque cambies de comercializadora, y es el dato que te pedirán para contratar en otro sitio.',
    fields: ['cups', 'cp'],
  },
  tipo_contrato: {
    id: 'tipo_contrato',
    title: 'Tipo de contrato',
    explanation:
      'Determina cómo se calcula el precio de tu energía: regulada (PVPC), fija, indexada al mercado mayorista, tarifa plana o flexible. En una fija el precio no se mueve durante el contrato; en una indexada sigue al mercado y puede subir o bajar cada mes.',
    fields: ['tc', 'tf', 'rev'],
  },
  revision_precios: {
    id: 'revision_precios',
    title: 'Revisión de precios',
    explanation:
      'Cada cuánto puede tu comercializadora actualizar los precios del contrato. Una revisión anual da más estabilidad que una mensual.',
    fields: ['rev'],
  },
  cambio_potencia: {
    id: 'cambio_potencia',
    title: 'Cambio de potencia contratada',
    explanation: `Bajar la potencia contratada tiene un coste único de unos ${formatCurrency(POWER_CHANGE_FEE_EUR)} (derechos de enganche más IVA) y se puede hacer una vez cada doce meses. Si el ahorro anual supera ese importe, se recupera en menos de un año.`,
    fields: ['pP1', 'pP2', 'pmaxP1', 'pmaxP2'],
  },
  consumo_anual: {
    id: 'consumo_anual',
    title: 'Consumo anual',
    explanation:
      'El consumo acumulado de los últimos doce meses por tramo horario. Es el dato que usan los comparadores para estimar lo que pagarías con otra oferta, porque una sola factura puede no ser representativa.',
    fields: ['caP1', 'caP2', 'caP3', 'iniA'],
  },
};

/** All concept ids, in a stable order suitable for listing. */
export const CONCEPT_IDS = Object.keys(GLOSSARY) as ConceptId[];

/** Look up a concept, returning null for an unknown id. */
export const getConcept = (id: string): Concept | null =>
  (GLOSSARY as Record<string, Concept>)[id] ?? null;

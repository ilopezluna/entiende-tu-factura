/**
 * Tool definitions for the factura-luz MCP server.
 *
 * Names and descriptions are in English so the calling model reasons about them
 * reliably; everything the user eventually reads is Spanish.
 */

import { z } from 'zod';

import { CONCEPT_IDS, GLOSSARY, getConcept, getQrField } from '../../../src/lib/cnmc';
import type { QrParameters } from '../../../src/lib/cnmc';
import { resolveInvoice, type InvoiceInput } from '../invoice';
import { presentInvoice } from '../present';
import { presentPower, presentSimulation } from '../presentPower';
import { invoiceInputShape } from './schemas';

/** MCP tools return content blocks; every tool here answers with one JSON block. */
const json = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
});

const asInvoiceInput = (args: {
  file_path?: string;
  qr_url?: string;
  invoice?: Record<string, unknown>;
}): InvoiceInput => ({
  file_path: args.file_path,
  qr_url: args.qr_url,
  invoice: args.invoice as QrParameters | undefined,
});

export const readInvoiceTool = {
  name: 'read_invoice',
  config: {
    title: 'Leer factura de la luz',
    description:
      'Read a Spanish electricity invoice and return everything it says, in structured form. ' +
      'Decodes the CNMC QR code from a PDF or image on this machine, then returns the supply point, ' +
      'the contract and what it means, the billing period, contracted and demanded power, ' +
      'consumption, prices, the amounts billed, an averaged monthly estimate, a Spanish summary you ' +
      'can relay to the user, and warnings about anything uncertain. Start here for any question ' +
      'about an invoice.',
    inputSchema: invoiceInputShape,
  },
  handler: async (args: Parameters<typeof asInvoiceInput>[0]) => {
    const { qrParams, source } = await resolveInvoice(asInvoiceInput(args));
    return json({ source, ...presentInvoice(qrParams) });
  },
};

export const analyzePowerTool = {
  name: 'analyze_power',
  config: {
    title: '¿Puedo bajar la potencia contratada?',
    description:
      'Decide whether the user can lower their contracted power (potencia contratada) and how much ' +
      'they would save per year. Compares the power they pay for against the maximum their meter ' +
      'actually recorded, leaving a safety margin, and works out the payback period against the ' +
      'one-off fee for changing it. This is the single most common way to cut a Spanish electricity ' +
      'bill without changing supplier.',
    inputSchema: invoiceInputShape,
  },
  handler: async (args: Parameters<typeof asInvoiceInput>[0]) => {
    const { qrParams, source } = await resolveInvoice(asInvoiceInput(args));
    return json({ source, ...presentPower(qrParams) });
  },
};

export const simulatePowerChangeTool = {
  name: 'simulate_power_change',
  config: {
    title: 'Simular un cambio de potencia',
    description:
      'Work out the annual saving for a specific pair of contracted powers, rather than the ' +
      'recommended one. Use it to answer "and if I set it to 3 kW?". Warns when the proposal is ' +
      'below the power the meter actually recorded, which would trip the breaker.',
    inputSchema: {
      ...invoiceInputShape,
      p1_kw: z.number().positive().describe('Proposed contracted power for P1 (punta), in kW.'),
      p2_kw: z.number().positive().describe('Proposed contracted power for P2 (valle), in kW.'),
    },
  },
  handler: async (
    args: Parameters<typeof asInvoiceInput>[0] & { p1_kw: number; p2_kw: number },
  ) => {
    const { qrParams, source } = await resolveInvoice(asInvoiceInput(args));
    return json({ source, ...presentSimulation(qrParams, args.p1_kw, args.p2_kw) });
  },
};

export const explainConceptTool = {
  name: 'explain_concept',
  config: {
    title: 'Explicar un concepto de la factura',
    description:
      'Explain one concept of a Spanish electricity bill in plain Spanish, ready to relay to the ' +
      'user. Pass an invoice as well and the explanation comes back with that invoice’s own ' +
      'figures for the fields involved. Call list_concepts, or read the cnmc://glossary resource, ' +
      'to see the available concepts.',
    inputSchema: {
      ...invoiceInputShape,
      concept: z
        .enum(CONCEPT_IDS as [string, ...string[]])
        .describe('The concept to explain, for example termino_potencia or impuesto_electricidad.'),
    },
  },
  handler: async (args: Parameters<typeof asInvoiceInput>[0] & { concept: string }) => {
    const concept = getConcept(args.concept);
    if (!concept) {
      throw new Error(
        `Concepto desconocido: ${args.concept}. Disponibles: ${CONCEPT_IDS.join(', ')}.`,
      );
    }

    const hasInvoice = Boolean(args.file_path || args.qr_url || args.invoice);
    if (!hasInvoice) {
      return json({
        ...concept,
        fields: concept.fields.map((field) => ({ field, ...getQrField(field) })),
      });
    }

    const { qrParams } = await resolveInvoice(asInvoiceInput(args));
    return json({
      id: concept.id,
      title: concept.title,
      explanation: concept.explanation,
      your_values: concept.fields.map((field) => ({
        field,
        ...getQrField(field),
        value: qrParams[field] ?? null,
      })),
    });
  },
};

export const listConceptsTool = {
  name: 'list_concepts',
  config: {
    title: 'Listar conceptos explicables',
    description:
      'List every invoice concept explain_concept can describe, with its id and Spanish title. ' +
      'Takes no arguments.',
    inputSchema: {},
  },
  handler: async () =>
    json({
      concepts: CONCEPT_IDS.map((id) => ({
        id,
        title: GLOSSARY[id].title,
        fields: GLOSSARY[id].fields,
      })),
    }),
};

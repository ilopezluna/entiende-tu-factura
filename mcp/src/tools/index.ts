/**
 * Tool definitions for the factura-luz MCP server.
 *
 * Names and descriptions are in English so the calling model reasons about them
 * reliably; everything the user eventually reads is Spanish.
 *
 * The tools extract and explain; they deliberately do not compute. Anything that
 * is arithmetic over data already returned is the calling agent's job, and the
 * conventions it needs are published as resources (see `../resources.ts`).
 */

import { z } from 'zod';

import { CONCEPT_IDS, GLOSSARY, getConcept, getQrField } from '../../../src/lib/cnmc';
import type { QrParameters } from '../../../src/lib/cnmc';
import { resolveInvoice, type InvoiceInput } from '../invoice';
import { presentInvoice } from '../present';
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
      'consumption, prices, the amounts billed, and an averaged monthly estimate. Write the ' +
      'explanation for the user yourself, in Spanish, from these figures. Check the `inferences` ' +
      'array: it lists any figure the server deduced rather than read off the invoice, which you ' +
      'could not tell apart otherwise, and those you must present as estimates. Start here for any ' +
      'question about an invoice. To answer whether the user can lower their contracted power, or what they ' +
      'would save, work it out yourself from this data using the recipe in the cnmc://power-method ' +
      'resource, which pins down the safety margin, the rounding and the tax order.',
    inputSchema: invoiceInputShape,
  },
  handler: async (args: Parameters<typeof asInvoiceInput>[0]) => {
    const { qrParams, source } = await resolveInvoice(asInvoiceInput(args));
    return json({ source, ...presentInvoice(qrParams) });
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

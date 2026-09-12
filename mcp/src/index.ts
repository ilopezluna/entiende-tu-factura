/**
 * factura-luz-mcp — an MCP server that reads and explains Spanish electricity
 * invoices from their CNMC QR code.
 *
 * Runs locally over stdio. It reads files from disk and makes no network calls
 * of any kind: the invoice never leaves the machine it is on.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { version as packageVersion } from '../package.json';

import {
  contractTypeTable,
  glossaryResource,
  powerMethodResource,
  qrFieldsResource,
} from './resources.js';
import { explainConceptTool, listConceptsTool, readInvoiceTool } from './tools/index.js';

const server = new McpServer({
  name: 'factura-luz',
  // Taken from package.json rather than written out again: tsup inlines it at
  // build time, so the version announced over the protocol cannot drift from the
  // one published to npm.
  version: packageVersion,
});

/**
 * Turn a thrown error into a tool error the agent can act on, rather than a
 * transport failure. The messages are Spanish because they are often the most
 * useful thing to show the user directly.
 */
const guard = <A extends Record<string, any>>(handler: (args: A) => Promise<any>) => {
  return async (args: A) => {
    try {
      return await handler(args);
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : 'Error desconocido leyendo la factura.',
          },
        ],
      };
    }
  };
};

for (const tool of [readInvoiceTool, explainConceptTool, listConceptsTool]) {
  server.registerTool(tool.name, tool.config as any, guard(tool.handler as any) as any);
}

const jsonResource = (uri: string, payload: unknown) => ({
  contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(payload, null, 2) }],
});

server.registerResource(
  'qr-fields',
  'cnmc://qr-fields',
  {
    title: 'Campos del QR de la CNMC',
    description:
      'Every field encoded in the CNMC invoice QR code, with its Spanish name, unit, whether it is ' +
      'mandatory, and the quirks worth knowing. Based on the BOE resolution of 6 October 2022.',
    mimeType: 'application/json',
  },
  async () => jsonResource('cnmc://qr-fields', qrFieldsResource()),
);

server.registerResource(
  'glossary',
  'cnmc://glossary',
  {
    title: 'Glosario de la factura de la luz',
    description:
      'Plain-Spanish explanations of the concepts on a Spanish electricity bill, each linked to the ' +
      'QR fields it describes.',
    mimeType: 'application/json',
  },
  async () => jsonResource('cnmc://glossary', glossaryResource()),
);

server.registerResource(
  'power-method',
  'cnmc://power-method',
  {
    title: 'Cómo calcular si se puede bajar la potencia',
    description:
      'The recipe for deciding whether the contracted power can be lowered and what that would ' +
      'save: the safety margin, the rounding to contractable steps, the order of the tax cascade ' +
      'and the one-off change fee. Read this before answering a power question from read_invoice ' +
      'data, so your figures match the ones the project website shows. Includes a worked example ' +
      'to check yourself against.',
    mimeType: 'application/json',
  },
  async () => jsonResource('cnmc://power-method', powerMethodResource()),
);

server.registerResource(
  'contract-types',
  'cnmc://contract-types',
  {
    title: 'Tipos de contrato eléctrico',
    description:
      'The contract types the CNMC QR can encode (PVPC, fija, indexada, tarifa plana, flexible), ' +
      'with what each one means for the price the user pays.',
    mimeType: 'application/json',
  },
  async () => jsonResource('cnmc://contract-types', contractTypeTable()),
);

server.registerPrompt(
  'entender-factura',
  {
    title: 'Entender una factura de la luz',
    description:
      'Walk through a Spanish electricity invoice file and explain it to the user in plain Spanish.',
    argsSchema: {
      file_path: z.string().describe('Ruta al PDF o imagen de la factura.'),
    },
  },
  ({ file_path }) => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            `Lee la factura de la luz que hay en ${file_path} y explícamela en español claro.`,
            '',
            'Sigue estos pasos:',
            `1. Llama a read_invoice con file_path "${file_path}".`,
            '2. Cuéntame qué tarifa tengo y qué significa, cuánto he pagado y en qué se va el dinero',
            '   (energía, potencia, impuestos), con cifras concretas en euros.',
            '3. Lee el recurso cnmc://power-method y aplica esa receta a los datos del paso 1 para',
            '   decirme si puedo bajar la potencia contratada y cuánto ahorraría al año. Sigue el',
            '   margen, el redondeo y el orden de los impuestos tal como los define el recurso.',
            '4. Avísame de cualquier cosa relevante: permanencia, fin de contrato, descuentos que',
            '   caducan, o datos que falten en la factura.',
            '5. Si el campo inferences trae algo, cuéntamelo con tus palabras: son cifras que el',
            '   servidor ha deducido, no leído de la factura, y quiero saber qué partes son',
            '   estimaciones antes de fiarme de ellas.',
            '',
            'No inventes cifras. Las de la factura salen de read_invoice tal cual; las de potencia,',
            'de aplicar el método del recurso a esas mismas cifras, nunca de estimar a ojo.',
          ].join('\n'),
        },
      },
    ],
  }),
);

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the protocol, so any human-facing note must go to stderr.
  console.error(
    'factura-luz-mcp listo. Todo se procesa en local: la factura no sale de este ordenador.',
  );
};

main().catch((error) => {
  console.error('factura-luz-mcp no ha podido arrancar:', error);
  process.exit(1);
});

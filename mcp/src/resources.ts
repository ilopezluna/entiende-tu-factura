/**
 * Read-only reference material the server exposes as MCP resources.
 *
 * These let an agent reason about the CNMC invoice format itself, not just run a
 * tool over one file.
 */

import {
  CONCEPT_IDS,
  ContractType,
  GLOSSARY,
  QR_FIELDS,
  getContractTypeCategory,
  getContractTypeExplanation,
  getContractTypeLabel,
  isSinglePriceContract,
} from '../../src/lib/cnmc';

export const CONTRACT_TYPE_IDS = Object.values(ContractType);

export const qrFieldsResource = () => ({
  source: 'Resolución del BOE de 6 de octubre de 2022, Tabla 1',
  description:
    'Campos codificados en el QR de las facturas eléctricas españolas. La URL del QR tiene la forma ' +
    'https://comparador.cnmc.gob.es/comparador/QRE?<campo>=<valor>&...',
  fields: Object.entries(QR_FIELDS).map(([field, doc]) => ({ field, ...doc })),
});

export const glossaryResource = () => ({
  description:
    'Conceptos de una factura de la luz española, explicados en lenguaje llano y enlazados a los ' +
    'campos del QR que los describen.',
  concepts: CONCEPT_IDS.map((id) => GLOSSARY[id]),
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

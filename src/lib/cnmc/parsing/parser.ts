import { QrParameters } from '../types';

/**
 * CNMC Parameter Parser
 * Handles parsing and validation of CNMC URL parameters
 */

/**
 * All known CNMC parameter fields
 */
const KNOWN_CNMC_FIELDS = new Set([
  'cp',
  'cups',
  'com',
  'pP1',
  'pP2',
  'pmaxP1',
  'pmaxP2',
  'caP1',
  'caP2',
  'caP3',
  'cfP1',
  'cfP2',
  'cfP3',
  'iniA',
  'iniF',
  'finF',
  'fFact',
  'finContrato',
  'finPen',
  'tc',
  'tf',
  'prP1',
  'prP2',
  'prE1',
  'prE2',
  'prE3',
  'imp',
  'impPot',
  'impEner',
  'impSA',
  'impOtrosConIE',
  'impOtrosSinIE',
  'dto',
  'exc',
  'dtoBS',
  'finBS',
  'ajuste',
  'cfP1flex',
  'cfP2flex',
  'cfP1Flex',
  'cfP2Flex',
  'cambio',
  'promo',
  'verde',
  'rev',
]);

/**
 * Parse and validate CNMC QR URL parameters
 * Logs any unexpected fields that are not defined in the QrParameters interface
 */
export function parseQrParameters(url: string): QrParameters {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Log unexpected fields
    Object.keys(params).forEach((key) => {
      if (!KNOWN_CNMC_FIELDS.has(key)) {
        console.warn(`[CNMC Parser] Unexpected QR parameter found: ${key}=${params[key]}`);
      }
    });

    // Parse and convert to proper types
    const qrParams: QrParameters = {
      // Required fields
      cp: params.cp || '',
      cups: params.cups || '',
      com: params.com || '',
      pP1: parseFloat(params.pP1) || 0,
      pP2: parseFloat(params.pP2) || 0,
      pmaxP1: parseFloat(params.pmaxP1) || 0,
      pmaxP2: parseFloat(params.pmaxP2) || 0,
      caP1: parseInt(params.caP1) || 0,
      caP2: parseInt(params.caP2) || 0,
      caP3: parseInt(params.caP3) || 0,
      impPot: parseFloat(params.impPot) || 0,
      iniA: params.iniA || '',
      tc: params.tc || '',

      // Optional fields - only include if present
      ...(params.cfP1 && { cfP1: parseInt(params.cfP1) }),
      ...(params.cfP2 && { cfP2: parseInt(params.cfP2) }),
      ...(params.cfP3 && { cfP3: parseInt(params.cfP3) }),
      ...(params.iniF && { iniF: params.iniF }),
      ...(params.finF && { finF: params.finF }),
      ...(params.fFact && { fFact: params.fFact }),
      ...(params.finContrato && { finContrato: params.finContrato }),
      ...(params.finPen && { finPen: params.finPen }),
      ...(params.tf && { tf: params.tf }),
      ...(params.prP1 && { prP1: parseFloat(params.prP1) }),
      ...(params.prP2 && { prP2: parseFloat(params.prP2) }),
      ...(params.prE1 && { prE1: parseFloat(params.prE1) }),
      ...(params.prE2 && { prE2: parseFloat(params.prE2) }),
      ...(params.prE3 && { prE3: parseFloat(params.prE3) }),
      ...(params.imp && { imp: parseFloat(params.imp) }),
      ...(params.impPot && { impPot: parseFloat(params.impPot) }),
      ...(params.impEner && { impEner: parseFloat(params.impEner) }),
      ...(params.impSA && { impSA: parseFloat(params.impSA) }),
      ...(params.impOtrosConIE && {
        impOtrosConIE: parseFloat(params.impOtrosConIE),
      }),
      ...(params.impOtrosSinIE && {
        impOtrosSinIE: parseFloat(params.impOtrosSinIE),
      }),
      ...(params.dto && { dto: parseFloat(params.dto) }),
      ...(params.exc && { exc: parseFloat(params.exc) }),
      ...(params.dtoBS && { dtoBS: parseFloat(params.dtoBS) }),
      ...(params.finBS && { finBS: parseFloat(params.finBS) }),
      ...(params.ajuste && { ajuste: parseFloat(params.ajuste) }),
      ...((params.cfP1flex || params.cfP1Flex) && {
        cfP1flex: parseInt(params.cfP1flex || params.cfP1Flex),
      }),
      ...((params.cfP2flex || params.cfP2Flex) && {
        cfP2flex: parseInt(params.cfP2flex || params.cfP2Flex),
      }),
      ...(params.cambio && { cambio: parseInt(params.cambio) }),
      ...(params.promo && { promo: parseInt(params.promo) }),
      ...(params.verde && { verde: parseInt(params.verde) }),
      ...(params.rev && { rev: parseInt(params.rev) }),
    };

    return qrParams;
  } catch {
    throw new Error('Error parsing CNMC URL parameters');
  }
}

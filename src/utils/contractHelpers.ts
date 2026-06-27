import { ContractType, PriceRevisionFrequency } from '../lib/cnmc';
import { formatNumber } from './formatNumber';

export function getContractTypeFromTc(tc: string): ContractType | null {
  const code = tc.charAt(0).toUpperCase();
  const values = Object.values(ContractType) as string[];
  if (values.includes(code)) return code as ContractType;
  return null;
}

export function getContractTypeLabel(type: ContractType): string {
  const labels: Record<ContractType, string> = {
    [ContractType.PVPC]: 'PVPC (Regulada)',
    [ContractType.INDEXED_HOURLY]: 'Indexada horaria',
    [ContractType.INDEXED_SINGLE]: 'Indexada precio único',
    [ContractType.INDEXED_3PERIODS]: 'Indexada 3 periodos',
    [ContractType.FIXED_3PERIODS]: 'Fija 3 periodos',
    [ContractType.FIXED_SINGLE]: 'Fija precio único',
    [ContractType.FLEXIBLE]: 'Flexible',
    [ContractType.FLAT_RATE]: 'Tarifa plana',
  };
  return labels[type];
}

export function getContractTypeExplanation(type: ContractType): string {
  const explanations: Record<ContractType, string> = {
    [ContractType.PVPC]:
      'Tu precio de energía varía cada hora según el mercado mayorista. Es la tarifa regulada por el Gobierno.',
    [ContractType.INDEXED_HOURLY]:
      'Tu precio sigue el mercado mayorista hora a hora, pero con tu comercializadora, no con la regulada.',
    [ContractType.INDEXED_SINGLE]:
      'El precio varía con el mercado, pero tu comercializadora te aplica un precio único para todas las horas.',
    [ContractType.INDEXED_3PERIODS]:
      'El precio varía con el mercado, con precios diferentes según el tramo horario (punta, llano, valle).',
    [ContractType.FIXED_3PERIODS]:
      'Precio fijo con diferenciación por tramo horario: punta, llano y valle. No te afectan las subidas del mercado.',
    [ContractType.FIXED_SINGLE]:
      'Pagas un precio fijo por la energía, independientemente de la hora o del mercado.',
    [ContractType.FLEXIBLE]:
      'Tarifa flexible que puede combinar tramos fijos y variables según tu comercializadora.',
    [ContractType.FLAT_RATE]: 'Pagas una cuota fija al mes sin importar cuánto consumas.',
  };
  return explanations[type];
}

export function getContractTypeCategory(
  type: ContractType,
): 'regulated' | 'fixed' | 'indexed' | 'flat' | 'flexible' {
  switch (type) {
    case ContractType.PVPC:
      return 'regulated';
    case ContractType.FIXED_3PERIODS:
    case ContractType.FIXED_SINGLE:
      return 'fixed';
    case ContractType.INDEXED_HOURLY:
    case ContractType.INDEXED_SINGLE:
    case ContractType.INDEXED_3PERIODS:
      return 'indexed';
    case ContractType.FLAT_RATE:
      return 'flat';
    case ContractType.FLEXIBLE:
      return 'flexible';
  }
}

export function getRevisionFrequencyLabel(rev: number): string | null {
  const labels: Record<number, string> = {
    [PriceRevisionFrequency.ANNUAL]: 'Anual',
    [PriceRevisionFrequency.BIANNUAL]: 'Semestral',
    [PriceRevisionFrequency.QUARTERLY]: 'Trimestral',
    [PriceRevisionFrequency.MONTHLY]: 'Mensual',
    [PriceRevisionFrequency.EVERY_3_YEARS]: 'Cada 3 años',
    [PriceRevisionFrequency.EVERY_5_YEARS]: 'Cada 5 años',
  };
  return labels[rev] ?? null;
}

export function formatPricePerKwh(price: number): string {
  return `${formatNumber(price, 4)} €/kWh`;
}

export function isSinglePriceContract(type: ContractType): boolean {
  return (
    type === ContractType.FIXED_SINGLE ||
    type === ContractType.INDEXED_SINGLE ||
    type === ContractType.FLAT_RATE
  );
}

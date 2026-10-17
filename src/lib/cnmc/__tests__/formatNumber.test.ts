import { describe, it, expect } from 'vitest';
import { formatCurrencyPerDay } from '../format/formatNumber';

describe('formatCurrencyPerDay', () => {
  it('formats with the standard two decimals', () => {
    expect(formatCurrencyPerDay(4.72)).toBe('4,72€/día');
    expect(formatCurrencyPerDay(1.5)).toBe('1,50€/día');
  });

  it('omits the decimals when they are zero', () => {
    expect(formatCurrencyPerDay(2)).toBe('2€/día');
  });

  it('shows an explicit floor for a nonzero sub-cent cost', () => {
    // 0,01€ repartidos en 365 días ≈ 0,0000274€/día: nunca «0€/día».
    expect(formatCurrencyPerDay(0.01 / 365)).toBe('< 0,01€/día');
    expect(formatCurrencyPerDay(0.004)).toBe('< 0,01€/día');
    expect(formatCurrencyPerDay(0.005)).toBe('0,01€/día');
  });
});

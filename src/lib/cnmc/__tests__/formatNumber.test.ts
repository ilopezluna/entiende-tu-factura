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

  it('does not round a nonzero sub-half-cent cost to zero', () => {
    expect(formatCurrencyPerDay(0.004)).toBe('0,0040€/día');
  });
});

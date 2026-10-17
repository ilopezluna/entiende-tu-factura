import { calculatePowerByPeriod } from '../utils';
import { parseQrParameters } from '../parsing';

// =============================================================================
// Helper functions for readable test comparisons
// =============================================================================

const toFixed2 = (num: number): string => num.toFixed(2);

const expectToFixed2 = (actual: number, expected: number) => {
  expect(toFixed2(actual)).toBe(toFixed2(expected));
};

// =============================================================================
// calculatePowerByPeriod tests
// =============================================================================

describe('calculatePowerByPeriod', () => {
  // F0 (fija): daily prices (€/kW/día), pP1 = pP2 = 10.39
  const dailyQr =
    'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=10.39&pP2=10.39&tc=F0&com=R2-760&cups=ES0031405258503001AZ&iniA=2025-08-31&impPot=34.85&prP1=0.0971&prP2=0.0271';

  // A0 (indexada): annual prices (€/kW/año); valle annual price is < 1 (must stay annual)
  const annualQr =
    'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=3.40&pP2=3.40&tc=A0&com=R2-292&cups=ES0026000000431709PS0F&iniA=2025-09-04&impPot=7.45&prP1=30.043548&prP2=0.697584';

  test('daily-priced contract: keeps €/kW/día and computes €/mes per period', () => {
    const periods = calculatePowerByPeriod(parseQrParameters(dailyQr));
    expect(periods).toHaveLength(2);

    expect(periods[0]).toMatchObject({ period: 'P1', label: 'Punta', power: 10.39 });
    expectToFixed2(periods[0].pricePerDay, 0.0971);
    expectToFixed2(periods[0].monthlyCost, 10.39 * 0.0971 * (365.25 / 12));

    expect(periods[1]).toMatchObject({ period: 'P2', label: 'Valle', power: 10.39 });
    expectToFixed2(periods[1].pricePerDay, 0.0271);
    expectToFixed2(periods[1].monthlyCost, 10.39 * 0.0271 * (365.25 / 12));
  });

  test('annual-priced contract: normalizes price to €/kW/día (incl. valle < 1 €/kW/año)', () => {
    const periods = calculatePowerByPeriod(parseQrParameters(annualQr));
    expect(periods).toHaveLength(2);

    // Annual prices divided by 365 for the daily display
    expectToFixed2(periods[0].pricePerDay, 30.043548 / 365);
    expectToFixed2(periods[1].pricePerDay, 0.697584 / 365);
    // Monthly cost uses the annual ÷ 12 formula
    expectToFixed2(periods[0].monthlyCost, (3.4 * 30.043548) / 12);
    expectToFixed2(periods[1].monthlyCost, (3.4 * 0.697584) / 12);
  });

  test('omits periods without a power price', () => {
    const noPrice =
      'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=10.39&pP2=10.39&tc=F0&com=R2-760&cups=ESxx&iniA=2025-08-31&impPot=0';
    expect(calculatePowerByPeriod(parseQrParameters(noPrice))).toHaveLength(0);
  });
});

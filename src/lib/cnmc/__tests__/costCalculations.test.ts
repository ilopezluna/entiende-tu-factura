import {
  calculateActualMonths,
  calculateCostBreakdown,
  calculatePowerByPeriod,
  CostBreakdown,
} from '../utils';
import { parseQrParameters } from '../parsing';

// =============================================================================
// Helper functions for readable test comparisons
// =============================================================================

const toFixed2 = (num: number): string => num.toFixed(2);

const expectToFixed2 = (actual: number, expected: number) => {
  expect(toFixed2(actual)).toBe(toFixed2(expected));
};

// =============================================================================
// calculateActualMonths tests
// =============================================================================

interface ActualMonthsCase {
  description: string;
  startDate: string;
  endDate?: string;
  expectedMonths: number;
}

const actualMonthsCases: ActualMonthsCase[] = [
  {
    description: 'Full year period (366 days - 2024 is leap year)',
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    expectedMonths: 12.02,
  },
  {
    description: 'One month period (30 days: Sept 1-30)',
    startDate: '2025-08-31',
    endDate: '2025-09-30',
    expectedMonths: 0.99,
  },
  {
    description: 'Short period (~4 months: Sept 1 to Jan 4)',
    startDate: '2025-08-31',
    endDate: '2026-01-04',
    expectedMonths: 4.14,
  },
  {
    description: 'Very short period (4 days) - clamped to minimum 0.5',
    startDate: '2025-08-31',
    endDate: '2025-09-03',
    expectedMonths: 0.5,
  },
  {
    description: 'No end date - defaults to 12 months',
    startDate: '2025-01-01',
    endDate: undefined,
    expectedMonths: 12,
  },
  {
    description: '6 months period (183 days: Apr 2 to Oct 1)',
    startDate: '2024-04-01',
    endDate: '2024-10-01',
    expectedMonths: 6.01,
  },
];

describe('calculateActualMonths', () => {
  actualMonthsCases.forEach(({ description, startDate, endDate, expectedMonths }, index) => {
    test(`Case #${index + 1}: ${description}`, () => {
      const result = calculateActualMonths(startDate, endDate);
      expectToFixed2(result, expectedMonths);
    });
  });
});

// =============================================================================
// calculateCostBreakdown tests (comprehensive parametrized)
// =============================================================================

interface EnergyPeriodExpected {
  period: string;
  consumption: number;
  pricePerKwh: number;
  totalCost: number;
}

interface BreakdownTestCase {
  description: string;
  qrUrl: string;
  expected: {
    // Energy breakdown
    energyByPeriod: EnergyPeriodExpected[];
    totalEnergyCost: number;
    actualMonths: number;
    monthlyEnergyCost: number;

    // Power costs
    totalPowerCost: number;
    monthlyPowerCost: number;

    // Subtotals and taxes
    subtotalElectricity: number;
    electricityTax: number;
    electricityTaxRate: number;
    equipmentFee: number;
    subtotalBeforeIVA: number;
    iva: number;
    ivaRate: number;

    // Final cost
    totalMonthlyCost: number;
  };
}

const breakdownTestCases: BreakdownTestCase[] = [
  {
    description: '10.39 kW contract - ~4 months consumption period',
    qrUrl:
      'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=10.39&pP2=10.39&tc=F0&finContrato=2026-09-01&com=R2-760&cups=ES0031405258503001AZ&tf=N&iniF=2025-11-28&finF=2025-12-31&impOtrosSinIE=1.48&exc=&fFact=2026-01-04&caP1=1088&caP2=672&caP3=1222&iniA=2025-08-31&pmaxP1=12.9&pmaxP2=0.0&verde=1&rev=0&imp=281.55&cfP1=446&cfP2=313&cfP3=730&ajuste=0.0&impPot=41.84&impEner=177.72&dto=0.00&prP1=0.095000&prP2=0.027000&prE1=0.119000&prE2=0.120000&prE3=0.119000&finBS=0.42',
    expected: {
      // Energy breakdown - values from actual calculation
      energyByPeriod: [
        { period: 'P1', consumption: 1088, pricePerKwh: 0.119, totalCost: 129.47 },
        { period: 'P2', consumption: 672, pricePerKwh: 0.12, totalCost: 80.64 },
        { period: 'P3', consumption: 1222, pricePerKwh: 0.119, totalCost: 145.42 },
      ],
      totalEnergyCost: 355.53,
      actualMonths: 4.14,
      monthlyEnergyCost: 85.88,

      // Power costs
      totalPowerCost: 41.84,
      monthlyPowerCost: 38.58,

      // Subtotals and taxes
      subtotalElectricity: 124.47,
      electricityTax: 6.36,
      electricityTaxRate: 0.05,
      equipmentFee: 0.83,
      subtotalBeforeIVA: 131.66,
      iva: 27.65,
      ivaRate: 0.21,

      // Final cost
      totalMonthlyCost: 159.31,
    },
  },
  {
    description: '5.75 kW contract - standard residential',
    qrUrl:
      'https://comparador.cnmc.gob.es/comparador/QRE?cp=08320&pP1=5.75&pP2=5.75&tc=F0&finContrato=2026-08-25&com=R2-760&cups=ES0031408650658005XH&tf=N&iniF=2025-10-22&finF=2025-11-23&impOtrosSinIE=0.85&exc=&fFact=2025-11-28&caP1=156&caP2=141&caP3=255&iniA=2025-08-24&pmaxP1=5.12&pmaxP2=0.0&verde=1&rev=0&imp=58.75&cfP1=52&cfP2=42&cfP3=94&ajuste=0.0&impPot=22.44&impEner=22.55&dto=0.00&prP1=0.095000&prP2=0.027000&prE1=0.119000&prE2=0.120000&prE3=0.119000&finBS=0.41',
    expected: {
      // Energy breakdown
      energyByPeriod: [
        { period: 'P1', consumption: 156, pricePerKwh: 0.119, totalCost: 18.56 },
        { period: 'P2', consumption: 141, pricePerKwh: 0.12, totalCost: 16.92 },
        { period: 'P3', consumption: 255, pricePerKwh: 0.119, totalCost: 30.34 },
      ],
      totalEnergyCost: 65.83,
      actualMonths: 3.15,
      monthlyEnergyCost: 20.87,

      // Power costs
      totalPowerCost: 22.44,
      monthlyPowerCost: 21.35,

      // Subtotals and taxes
      subtotalElectricity: 42.22,
      electricityTax: 2.16,
      electricityTaxRate: 0.05,
      equipmentFee: 0.83,
      subtotalBeforeIVA: 45.21,
      iva: 9.49,
      ivaRate: 0.21,

      // Final cost
      totalMonthlyCost: 54.71,
    },
  },
  {
    description: '3.40 kW contract - A0 tariff, ~1 month period',
    qrUrl:
      'https://comparador.cnmc.gob.es/comparador/QRE?cp=33510&pP1=3.40&pP2=3.40&caP1=83&caP2=86&caP3=103&iniA=2025-09-04&tc=A0&finPen=0000-00-00&finContrato=2026-09-04&tf=N&imp=61.82&cfP1=83&cfP2=86&cfP3=103&iniF=2025-09-04&finF=2025-09-29&impSA=2.17&impOtrosConIE=0&impOtrosSinIE=0.69&exc=0.00&com=R2-292&cups=ES0026000000431709PS0F&pmaxP1=3.78&pmaxP2=3.17&fFact=2025-10-08&dtoBS=0&finBS=0.33&ajuste=-1&impPot=7.45&impEner=38.10&dto=0.00&prP1=30.043548&prP2=0.697584&prE1=0.198546&prE2=0.127507&prE3=0.103401&cfP1flex=&cfP2flex=&cambio=&promo=&verde=&rev=0',
    expected: {
      // Energy breakdown
      energyByPeriod: [
        { period: 'P1', consumption: 83, pricePerKwh: 0.198546, totalCost: 16.48 },
        { period: 'P2', consumption: 86, pricePerKwh: 0.127507, totalCost: 10.97 },
        { period: 'P3', consumption: 103, pricePerKwh: 0.103401, totalCost: 10.65 },
      ],
      totalEnergyCost: 38.1,
      actualMonths: 1.12,
      monthlyEnergyCost: 34.1,

      // Power costs
      totalPowerCost: 7.45,
      monthlyPowerCost: 8.71,

      // Subtotals and taxes
      subtotalElectricity: 42.81,
      electricityTax: 2.19,
      electricityTaxRate: 0.05,
      equipmentFee: 0.83,
      subtotalBeforeIVA: 45.83,
      iva: 9.62,
      ivaRate: 0.21,

      // Final cost
      totalMonthlyCost: 55.46,
    },
  },
  {
    description: 'Old numeric-tc format (tc=1) - no unit prices, fallback to imp/billingMonths',
    qrUrl:
      'https://comparador.cnmc.gob.es/comparador/QRE?cp=14191&bs=0&peaje=18&pP1=6.5kW&pP2=6.5kW&caP1=2281kWh&caP2=2130kWh&caP3=2750kWh&iniA=2025-03-11&finA=2026-02-08&tc=1&finPen=2026-03-10&reg=0&imp=199.15eur&cfP1=324kWh&cfP2=282kWh&cfP3=353kWh&iniF=2026-01-11&finF=2026-02-08&impSA=0eur&impOtros=0eur&exc=0eur&com=R2-852&cups=ES0031101368330001BM&pmaxP1=7.92kW&pmaxP2=0kW',
    expected: {
      energyByPeriod: [
        { period: 'P1', consumption: 2281, pricePerKwh: 0, totalCost: 0 },
        { period: 'P2', consumption: 2130, pricePerKwh: 0, totalCost: 0 },
        { period: 'P3', consumption: 2750, pricePerKwh: 0, totalCost: 0 },
      ],
      totalEnergyCost: 0,
      actualMonths: 10.97,
      monthlyEnergyCost: 0,

      totalPowerCost: 0,
      monthlyPowerCost: 0,

      subtotalElectricity: 0,
      electricityTax: 0,
      electricityTaxRate: 0.05,
      equipmentFee: 0.83,
      subtotalBeforeIVA: 0.83,
      iva: 0.17,
      ivaRate: 0.21,

      // Fallback: 199.15 / billingMonths(iniF=2026-01-11, finF=2026-02-08)
      totalMonthlyCost: 216.49,
    },
  },
];

describe('calculateCostBreakdown', () => {
  breakdownTestCases.forEach(({ description, qrUrl, expected }, index) => {
    describe(`Case #${index + 1}: ${description}`, () => {
      let breakdown: CostBreakdown;

      beforeAll(() => {
        const qrParams = parseQrParameters(qrUrl);
        breakdown = calculateCostBreakdown(qrParams);
      });

      test('should have all required properties', () => {
        expect(breakdown).toHaveProperty('energyByPeriod');
        expect(breakdown).toHaveProperty('totalEnergyCost');
        expect(breakdown).toHaveProperty('actualMonths');
        expect(breakdown).toHaveProperty('monthlyEnergyCost');
        expect(breakdown).toHaveProperty('totalPowerCost');
        expect(breakdown).toHaveProperty('monthlyPowerCost');
        expect(breakdown).toHaveProperty('subtotalElectricity');
        expect(breakdown).toHaveProperty('electricityTax');
        expect(breakdown).toHaveProperty('electricityTaxRate');
        expect(breakdown).toHaveProperty('equipmentFee');
        expect(breakdown).toHaveProperty('subtotalBeforeIVA');
        expect(breakdown).toHaveProperty('iva');
        expect(breakdown).toHaveProperty('ivaRate');
        expect(breakdown).toHaveProperty('totalMonthlyCost');
      });

      test('should have correct energy breakdown by period', () => {
        expect(breakdown.energyByPeriod).toHaveLength(expected.energyByPeriod.length);

        expected.energyByPeriod.forEach((expectedPeriod, periodIndex) => {
          expect(breakdown.energyByPeriod[periodIndex].period).toBe(expectedPeriod.period);
          expect(breakdown.energyByPeriod[periodIndex].consumption).toBe(
            expectedPeriod.consumption,
          );
          expectToFixed2(
            breakdown.energyByPeriod[periodIndex].pricePerKwh,
            expectedPeriod.pricePerKwh,
          );
          expectToFixed2(breakdown.energyByPeriod[periodIndex].totalCost, expectedPeriod.totalCost);
        });
      });

      test('should calculate total energy cost correctly', () => {
        expectToFixed2(breakdown.totalEnergyCost, expected.totalEnergyCost);
      });

      test('should calculate actual months correctly', () => {
        expectToFixed2(breakdown.actualMonths, expected.actualMonths);
      });

      test('should calculate monthly energy cost correctly', () => {
        expectToFixed2(breakdown.monthlyEnergyCost, expected.monthlyEnergyCost);
      });

      test('should calculate power costs correctly', () => {
        expectToFixed2(breakdown.totalPowerCost, expected.totalPowerCost);
        expectToFixed2(breakdown.monthlyPowerCost, expected.monthlyPowerCost);
      });

      test('should have correct tax rates and fees', () => {
        expectToFixed2(breakdown.electricityTaxRate, expected.electricityTaxRate);
        expectToFixed2(breakdown.ivaRate, expected.ivaRate);
        expectToFixed2(breakdown.equipmentFee, expected.equipmentFee);
      });

      test('should calculate subtotals correctly', () => {
        expectToFixed2(breakdown.subtotalElectricity, expected.subtotalElectricity);
        expectToFixed2(breakdown.electricityTax, expected.electricityTax);
        expectToFixed2(breakdown.subtotalBeforeIVA, expected.subtotalBeforeIVA);
        expectToFixed2(breakdown.iva, expected.iva);
      });

      test('should calculate total monthly cost correctly', () => {
        expectToFixed2(breakdown.totalMonthlyCost, expected.totalMonthlyCost);
      });
    });
  });
});

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

  test('sum of per-period monthly cost equals breakdown.monthlyPowerCost', () => {
    for (const qr of [dailyQr, annualQr]) {
      const params = parseQrParameters(qr);
      const sum = calculatePowerByPeriod(params).reduce((s, p) => s + p.monthlyCost, 0);
      expectToFixed2(sum, calculateCostBreakdown(params).monthlyPowerCost);
    }
  });
});

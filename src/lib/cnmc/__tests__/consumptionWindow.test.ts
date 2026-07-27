import { calculateActualMonths, resolveConsumptionMonths, calculateCostBreakdown } from '../utils';
import { parseQrParameters } from '../parsing';

const toFixed2 = (num: number): string => num.toFixed(2);

const expectToFixed2 = (actual: number, expected: number) => {
  expect(toFixed2(actual)).toBe(toFixed2(expected));
};

// Some retailers set iniA to the billing period start instead of a year back,
// which makes an annual caP total look like it was consumed in one month.
const BROKEN_INIA_QR =
  'https://comparador.cnmc.gob.es/comparador/QRE2?cp=00000&pP1=4.400&pP2=4.400&caP1=1107&caP2=1013&caP3=1272&iniA=2026-06-22&tc=E0&tf=N&imp=72.78&cfP1=94&cfP2=86&cfP3=108&iniF=2026-06-22&finF=2026-07-22&com=R2-000&cups=ES1234567890AZ0F&pmaxP1=5.048&pmaxP2=4.520&fFact=2026-07-27&ajuste=0&impPot=10.62&impEner=45.11&prP1=0.075903&prP2=0.001987&prE1=0.219750&prE2=0.140409&prE3=0.104191&rev=0';

// A new customer with a single month of history: caP legitimately equals cfP,
// so the short window is correct and must be left alone.
const SHORT_HISTORY_QR =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=10.39&pP2=10.39&tc=F0&com=R2-000&cups=ES1234567890AZ&tf=N&iniF=2025-08-31&finF=2025-09-29&fFact=2025-10-04&caP1=146&caP2=62&caP3=133&iniA=2025-08-31&imp=70.58&cfP1=146&cfP2=62&cfP3=133&impPot=36.77&impEner=40.73&prP1=0.095000&prP2=0.027000&prE1=0.119000&prE2=0.120000&prE3=0.119000';

// A conforming invoice with a genuine 12-month annual window.
const FULL_YEAR_QR =
  'https://comparador.cnmc.gob.es/comparador/QRE?cp=00000&pP1=4.4&pP2=4.4&caP1=578&caP2=477&caP3=1039&iniA=2024-11-18&tc=A0&tf=N&imp=55.15&cfP1=57&cfP2=42&cfP3=104&iniF=2025-10-16&finF=2025-11-18&com=R2-000&cups=ES1234567890GF&pmaxP1=2.76&pmaxP2=3.73&fFact=2025-11-21&impPot=12.23&impEner=29.88&prP1=30.043515&prP2=0.697515&prE1=0.217129&prE2=0.128903&prE3=0.116315&rev=0';

describe('resolveConsumptionMonths', () => {
  test('corrects an iniA that points at the billing period instead of a year back', () => {
    const qrParams = parseQrParameters(BROKEN_INIA_QR);

    // The dates on their own claim the annual consumption spans ~1.15 months.
    expect(calculateActualMonths(qrParams.iniA, qrParams.fFact)).toBeLessThan(2);

    // Cross-checking against the billing period recovers a plausible year.
    const resolved = resolveConsumptionMonths(qrParams);
    expect(resolved).toBeGreaterThan(10);
    expect(resolved).toBeLessThanOrEqual(12);
  });

  test('keeps a genuinely short window when caP matches cfP', () => {
    const qrParams = parseQrParameters(SHORT_HISTORY_QR);

    expectToFixed2(
      resolveConsumptionMonths(qrParams),
      calculateActualMonths(qrParams.iniA, qrParams.fFact),
    );
  });

  test('leaves a conforming twelve-month window untouched', () => {
    const qrParams = parseQrParameters(FULL_YEAR_QR);

    expectToFixed2(
      resolveConsumptionMonths(qrParams),
      calculateActualMonths(qrParams.iniA, qrParams.fFact),
    );
  });

  test('falls back to the date window when billing consumption is missing', () => {
    const qrParams = parseQrParameters(BROKEN_INIA_QR);
    const withoutBillingConsumption = {
      ...qrParams,
      cfP1: undefined,
      cfP2: undefined,
      cfP3: undefined,
    };

    expectToFixed2(
      resolveConsumptionMonths(withoutBillingConsumption),
      calculateActualMonths(qrParams.iniA, qrParams.fFact),
    );
  });

  test('never exceeds the twelve months caP is defined to cover', () => {
    const qrParams = parseQrParameters(BROKEN_INIA_QR);
    // An absurdly small billing consumption would imply a multi-year window.
    const exaggerated = { ...qrParams, cfP1: 1, cfP2: 0, cfP3: 0 };

    expect(resolveConsumptionMonths(exaggerated)).toBe(12);
  });
});

describe('calculateCostBreakdown with an unreliable iniA', () => {
  test('keeps the monthly estimate in the same league as the invoice total', () => {
    const qrParams = parseQrParameters(BROKEN_INIA_QR);
    const breakdown = calculateCostBreakdown(qrParams);

    // Before the window fix this produced 450.50 €/mes of energy and a 587.25
    // €/mes total, against an actual invoice of 72.78 € for ~30 days.
    expectToFixed2(breakdown.monthlyEnergyCost, 44.62);
    expectToFixed2(breakdown.totalMonthlyCost, 71.03);
    expect(breakdown.totalMonthlyCost).toBeLessThan(qrParams.imp! * 1.5);
    expect(breakdown.totalMonthlyCost).toBeGreaterThan(qrParams.imp! * 0.5);
  });

  test('reports a plausible consumption window to the UI', () => {
    const breakdown = calculateCostBreakdown(parseQrParameters(BROKEN_INIA_QR));

    // The card reads "Basado en tu consumo de los últimos N meses" from this,
    // and used to say 1 month for a full year of consumption.
    expect(Math.round(breakdown.actualMonths)).toBe(12);
  });
});

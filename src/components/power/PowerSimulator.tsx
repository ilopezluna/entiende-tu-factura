import React, { useMemo, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  PowerAnalysis,
  QrParameters,
  roundUpToStep,
  simulateAnnualSaving,
  MIN_RECOMMENDED_POWER_KW,
} from '../../lib/cnmc';
import { formatCurrency, formatPower } from '../../utils/formatNumber';

interface PowerSimulatorProps {
  qrParams: QrParameters;
  analysis: PowerAnalysis;
}

const roundKw = (value: number) => Math.round(value * 10) / 10;

/**
 * Interactive simulator: drag the slider(s) to any power and see the annual
 * saving instantly. Only rendered when the QR includes power prices
 * (the parent checks `analysis.hasPrices`).
 */
const PowerSimulator: React.FC<PowerSimulatorProps> = ({ qrParams, analysis }) => {
  const [p1, p2] = analysis.periods;

  // Most households contract the same power in both periods: one slider then.
  const linked = qrParams.pP1 === qrParams.pP2;

  const defaultP1 = p1.recommendedKw ?? p1.contractedKw;
  const defaultP2 = p2.recommendedKw ?? p2.contractedKw;
  // With a single slider, start at the more conservative recommendation.
  const linkedDefault = Math.max(defaultP1, defaultP2);

  const [simP1, setSimP1] = useState(linked ? linkedDefault : defaultP1);
  const [simP2, setSimP2] = useState(linked ? linkedDefault : defaultP2);

  const saving = useMemo(
    () => simulateAnnualSaving(qrParams, { p1Kw: simP1, p2Kw: simP2 }),
    [qrParams, simP1, simP2],
  );

  const resetToRecommended = () => {
    setSimP1(linked ? linkedDefault : defaultP1);
    setSimP2(linked ? linkedDefault : defaultP2);
  };

  const zoneMessage = (simKw: number, maxDemandKw: number | null, recommendedKw: number | null) => {
    if (maxDemandKw !== null && simKw < maxDemandKw) {
      return {
        tone: 'text-red-600',
        text: `Por debajo de los ${formatPower(maxDemandKw)} que ya has llegado a usar: te saltaría el ICP.`,
      };
    }
    if (recommendedKw !== null && simKw < recommendedKw) {
      return {
        tone: 'text-amber-600',
        text: 'Muy justo: por debajo del margen de seguridad del 10%.',
      };
    }
    return { tone: 'text-emerald-600', text: 'Con margen de seguridad suficiente.' };
  };

  const sliders = linked
    ? [
        {
          key: 'both',
          label: 'Potencia en ambos periodos',
          value: simP1,
          contractedKw: p1.contractedKw,
          maxDemandKw: Math.max(p1.maxDemandKw ?? 0, p2.maxDemandKw ?? 0) || null,
          recommendedKw: linkedDefault,
          onChange: (kw: number) => {
            setSimP1(kw);
            setSimP2(kw);
          },
        },
      ]
    : [
        {
          key: 'P1',
          label: `Potencia en ${p1.label} (P1)`,
          value: simP1,
          contractedKw: p1.contractedKw,
          maxDemandKw: p1.maxDemandKw,
          recommendedKw: p1.recommendedKw,
          onChange: setSimP1,
        },
        {
          key: 'P2',
          label: `Potencia en ${p2.label} (P2)`,
          value: simP2,
          contractedKw: p2.contractedKw,
          maxDemandKw: p2.maxDemandKw,
          recommendedKw: p2.recommendedKw,
          onChange: setSimP2,
        },
      ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <SlidersHorizontal className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-gray-900">Pruébalo tú: simulador de potencia</h3>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Mueve el control y verás al instante cuánto ahorrarías (o pagarías de más) al año. Todo se
        calcula en tu navegador.
      </p>

      {linked && defaultP1 !== defaultP2 && (
        <div className="bg-blue-50/50 p-4 rounded-lg border-l-4 border-primary mb-6">
          <p className="text-sm text-gray-700">
            Este control simula la <strong>misma potencia en punta y valle</strong>, que es lo más
            habitual. El ahorro de arriba es algo mayor porque también puedes contratar potencias
            distintas por periodo ({formatPower(defaultP1)} en punta y {formatPower(defaultP2)} en
            valle, como te recomendamos).
          </p>
        </div>
      )}

      <div className="space-y-6">
        {sliders.map((slider) => {
          const zone = zoneMessage(slider.value, slider.maxDemandKw, slider.recommendedKw);
          return (
            <div key={slider.key}>
              <div className="flex justify-between items-baseline mb-2">
                <label
                  htmlFor={`power-slider-${slider.key}`}
                  className="text-sm font-medium text-gray-700"
                >
                  {slider.label}
                </label>
                <span className="text-xl font-black text-gray-900">
                  {formatPower(slider.value)}
                </span>
              </div>
              <input
                id={`power-slider-${slider.key}`}
                type="range"
                min={MIN_RECOMMENDED_POWER_KW}
                max={roundUpToStep(slider.contractedKw) + 1}
                step={0.1}
                value={slider.value}
                onChange={(e) => slider.onChange(roundKw(parseFloat(e.target.value)))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatPower(MIN_RECOMMENDED_POWER_KW)}</span>
                <span>Ahora: {formatPower(slider.contractedKw)}</span>
                <span>{formatPower(roundUpToStep(slider.contractedKw) + 1)}</span>
              </div>
              <p className={`text-sm font-medium mt-2 ${zone.tone}`}>{zone.text}</p>
            </div>
          );
        })}
      </div>

      {saving && (
        <div
          className={`mt-6 rounded-xl p-6 text-center ${
            saving.total >= 0.005
              ? 'bg-emerald-50 border border-emerald-200'
              : saving.total <= -0.005
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-50 border border-gray-200'
          }`}
        >
          {saving.total >= 0.005 && (
            <>
              <p className="text-sm font-medium text-emerald-700 uppercase tracking-wide">
                Ahorro estimado con esta potencia
              </p>
              <p className="text-4xl font-black text-emerald-600 mt-1">
                {formatCurrency(saving.total)}
                <span className="text-lg font-bold text-emerald-700">/año</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Impuestos incluidos (impuesto eléctrico e IVA).
              </p>
            </>
          )}
          {saving.total <= -0.005 && (
            <>
              <p className="text-sm font-medium text-red-700 uppercase tracking-wide">
                Con esta potencia pagarías más
              </p>
              <p className="text-4xl font-black text-red-600 mt-1">
                {formatCurrency(Math.abs(saving.total))}
                <span className="text-lg font-bold text-red-700">/año MÁS</span>
              </p>
            </>
          )}
          {saving.total > -0.005 && saving.total < 0.005 && (
            <p className="text-lg font-bold text-gray-700">
              Igual que ahora: ni ahorras ni pagas de más.
            </p>
          )}
        </div>
      )}

      <button
        onClick={resetToRecommended}
        className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
      >
        <RotateCcw className="w-4 h-4" />
        Volver a la potencia recomendada
      </button>
    </div>
  );
};

export default PowerSimulator;

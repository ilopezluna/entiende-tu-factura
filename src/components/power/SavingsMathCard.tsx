import React from 'react';
import { PowerAnalysis, DAYS_PER_YEAR } from '../../lib/cnmc';
import { formatCurrency, formatNumber, formatPower } from '../../utils/formatNumber';

interface SavingsMathCardProps {
  analysis: PowerAnalysis;
}

/** €/kW/día with up to 6 decimals, trailing zeros trimmed. */
const formatPricePerDay = (value: number): string =>
  formatNumber(value, 6)
    .replace(/(,\d*?)0+$/, '$1')
    .replace(/,$/, '');

/**
 * Full transparency: the saving calculation, step by step, with the user's
 * real numbers. Rendered only when there is a lowering recommendation with
 * prices available (the parent checks it).
 */
const SavingsMathCard: React.FC<SavingsMathCardProps> = ({ analysis }) => {
  const saving = analysis.totalAnnualSaving;
  if (!saving) return null;

  const periodsWithSaving = analysis.periods.filter(
    (p) => p.freedKw > 0 && p.pricePerDay !== null && p.annualSavingBase !== null,
  );

  return (
    <div className="bg-gray-900 text-white rounded-xl p-8 md:p-12 shadow-xl overflow-hidden relative">
      <div className="relative z-10">
        <h3 className="text-2xl font-bold mb-2">Así hemos hecho la cuenta, paso a paso</h3>
        <p className="text-gray-400 mb-8 max-w-xl">
          Sin cajas negras: estos son tus números reales, sacados del QR de tu factura.
        </p>

        <div className="space-y-4">
          {periodsWithSaving.map((p) => (
            <div
              key={p.period}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-4 border-b border-gray-800"
            >
              <div>
                <p className="font-medium">
                  Periodo {p.label} ({p.period})
                </p>
                <p className="text-sm text-gray-400">
                  {formatPower(p.freedKw)} liberados × {formatPricePerDay(p.pricePerDay as number)}
                  €/kW/día × {DAYS_PER_YEAR} días
                </p>
              </div>
              <p className="font-bold text-lg">
                {formatCurrency(p.annualSavingBase as number)}/año
              </p>
            </div>
          ))}

          <div className="flex justify-between items-center pb-4 border-b border-gray-800">
            <p className="font-medium">Ahorro base (sin impuestos)</p>
            <p className="font-bold text-lg">{formatCurrency(saving.base)}/año</p>
          </div>

          <div className="flex justify-between items-center pb-4 border-b border-gray-800">
            <div>
              <p className="font-medium">+ Impuesto eléctrico (5,11%)</p>
              <p className="text-sm text-gray-400">
                Lo que dejas de pagar de este impuesto al reducir la base.
              </p>
            </div>
            <p className="font-bold text-lg">{formatCurrency(saving.electricityTax)}/año</p>
          </div>

          <div className="flex justify-between items-center pb-4 border-b border-gray-800">
            <div>
              <p className="font-medium">+ IVA (21%)</p>
              <p className="text-sm text-gray-400">
                Se aplica también sobre el impuesto eléctrico — sí, un impuesto sobre otro impuesto.
              </p>
            </div>
            <p className="font-bold text-lg">{formatCurrency(saving.iva)}/año</p>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <p className="font-bold text-lg">Ahorro total estimado</p>
            <p className="font-black text-2xl text-emerald-400">
              {formatCurrency(saving.total)}/año
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-8">
          El precio en €/kW/día sale del QR de tu factura (sin impuestos). La potencia recomendada
          es tu máxima demandada del último año + 10% de margen de seguridad, redondeada al alza en
          pasos de 0,1 kW.
        </p>
      </div>

      {/* Abstract Background Pattern */}
      <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
    </div>
  );
};

export default SavingsMathCard;

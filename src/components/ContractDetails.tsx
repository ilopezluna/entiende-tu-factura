import React from 'react';
import { QrParameters, calculatePowerByPeriod } from '../lib/cnmc';
import { FileText, Calendar, Leaf, Tag, RefreshCw } from 'lucide-react';
import {
  getContractTypeFromTc,
  getContractTypeLabel,
  getContractTypeExplanation,
  getContractTypeCategory,
  getRevisionFrequencyLabel,
  formatPricePerKwh,
  isSinglePriceContract,
} from '../utils/contractHelpers';
import { formatPower, formatCurrencyPerMonth, formatNumber } from '../utils/formatNumber';

interface ContractDetailsProps {
  qrParams: QrParameters;
}

const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
  regulated: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  fixed: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  indexed: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  flat: { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  flexible: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
};

const ContractDetails: React.FC<ContractDetailsProps> = ({ qrParams }) => {
  const contractType = getContractTypeFromTc(qrParams.tc);
  if (!contractType) return null;

  const label = getContractTypeLabel(contractType);
  const explanation = getContractTypeExplanation(contractType);
  const category = getContractTypeCategory(contractType);
  const style = categoryStyles[category];
  const singlePrice = isSinglePriceContract(contractType);

  const powerByPeriod = calculatePowerByPeriod(qrParams);
  const hasPowerPrices = powerByPeriod.length > 0;
  const totalMonthlyPower = powerByPeriod.reduce((sum, p) => sum + p.monthlyCost, 0);
  const hasEnergyPrices =
    qrParams.prE1 !== undefined || qrParams.prE2 !== undefined || qrParams.prE3 !== undefined;
  const hasPrices = hasPowerPrices || hasEnergyPrices;

  const revLabel = qrParams.rev !== undefined ? getRevisionFrequencyLabel(qrParams.rev) : null;

  const finContrato =
    qrParams.finContrato && qrParams.finContrato !== '0000-00-00'
      ? new Date(qrParams.finContrato + 'T00:00:00')
      : null;
  const finContratoValid = finContrato && !isNaN(finContrato.getTime()) ? finContrato : null;

  const hasChips =
    revLabel !== null ||
    finContratoValid !== null ||
    qrParams.verde === 1 ||
    (qrParams.promo !== undefined && qrParams.promo > 0);

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-1 bg-violet-500 rounded-full"></div>
        <h2 className="text-2xl font-bold text-gray-900">Entiende tu contrato</h2>
      </div>

      <div className="space-y-6">
        {/* Contract type card */}
        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-lg ${style.bg}`}>
              <FileText className={`w-7 h-7 ${style.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">{label}</h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text} border ${style.border}`}
                >
                  {category === 'regulated' && 'Regulada'}
                  {category === 'fixed' && 'Precio fijo'}
                  {category === 'indexed' && 'Precio variable'}
                  {category === 'flat' && 'Cuota fija'}
                  {category === 'flexible' && 'Flexible'}
                </span>
              </div>
            </div>
          </div>
          <p className="text-gray-600 leading-relaxed">{explanation}</p>
        </div>

        {/* Pricing table */}
        {hasPrices && (
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Precios de tu contrato</h3>
            <div
              className={`grid grid-cols-1 ${hasPowerPrices && hasEnergyPrices ? 'md:grid-cols-2' : ''} gap-8`}
            >
              {/* Power prices */}
              {hasPowerPrices && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Potencia
                  </h4>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-sm font-medium text-gray-500 pb-2">
                          Periodo
                        </th>
                        <th className="text-right text-sm font-medium text-gray-500 pb-2">
                          Potencia
                        </th>
                        <th className="text-right text-sm font-medium text-gray-500 pb-2">
                          Precio
                        </th>
                        <th className="text-right text-sm font-medium text-gray-500 pb-2">Coste</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {powerByPeriod.map((p) => (
                        <tr key={p.period} className="border-b border-gray-50">
                          <td className="py-2.5 text-gray-700">
                            {p.period} ({p.label})
                          </td>
                          <td className="py-2.5 text-right text-gray-700">
                            {formatPower(p.power)}
                          </td>
                          <td className="py-2.5 text-right text-gray-700">
                            {formatNumber(p.pricePerDay, 3)} €/kW/día
                          </td>
                          <td className="py-2.5 text-right font-medium text-gray-900">
                            {formatCurrencyPerMonth(p.monthlyCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td className="pt-2.5 font-semibold text-gray-900" colSpan={3}>
                          Total
                        </td>
                        <td className="pt-2.5 text-right font-bold text-gray-900">
                          {formatCurrencyPerMonth(totalMonthlyPower)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Lo que pagas por tener la potencia contratada, aunque no consumas nada. Es tu
                    coste fijo mensual.
                  </p>
                </div>
              )}

              {/* Energy prices */}
              {hasEnergyPrices && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Energía
                  </h4>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-sm font-medium text-gray-500 pb-2">
                          Periodo
                        </th>
                        <th className="text-right text-sm font-medium text-gray-500 pb-2">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {qrParams.prE1 !== undefined && (
                        <tr className="border-b border-gray-50">
                          <td className="py-2.5 text-gray-700">
                            {singlePrice ? 'Precio único' : 'P1 (Punta)'}
                          </td>
                          <td className="py-2.5 text-right font-medium text-gray-900">
                            {formatPricePerKwh(qrParams.prE1)}
                          </td>
                        </tr>
                      )}
                      {qrParams.prE2 !== undefined && (
                        <tr className="border-b border-gray-50">
                          <td className="py-2.5 text-gray-700">P2 (Llano)</td>
                          <td className="py-2.5 text-right font-medium text-gray-900">
                            {formatPricePerKwh(qrParams.prE2)}
                          </td>
                        </tr>
                      )}
                      {qrParams.prE3 !== undefined && (
                        <tr>
                          <td className="py-2.5 text-gray-700">P3 (Valle)</td>
                          <td className="py-2.5 text-right font-medium text-gray-900">
                            {formatPricePerKwh(qrParams.prE3)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Lo que pagas por cada kWh que consumes.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detail chips */}
        {hasChips && (
          <div className="flex flex-wrap gap-3">
            {revLabel && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm">
                <RefreshCw className="w-4 h-4 text-gray-400" />
                Revisión de precios: {revLabel}
              </span>
            )}
            {finContratoValid && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                Fin contrato:{' '}
                {finContratoValid.toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
            {qrParams.verde === 1 && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 shadow-sm">
                <Leaf className="w-4 h-4 text-emerald-500" />
                Energía 100% verde
              </span>
            )}
            {qrParams.promo !== undefined && qrParams.promo > 0 && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700 shadow-sm">
                <Tag className="w-4 h-4 text-violet-500" />
                Oferta promocional
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ContractDetails;

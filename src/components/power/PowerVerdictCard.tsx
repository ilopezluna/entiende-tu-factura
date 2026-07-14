import React from 'react';
import { AlertTriangle, CheckCircle2, Info, TrendingDown } from 'lucide-react';
import { PowerAnalysis } from '../../lib/cnmc';
import { formatCurrency, formatPower } from '../../utils/formatNumber';

interface PowerVerdictCardProps {
  analysis: PowerAnalysis;
}

/** Verdict banner + per-period comparison bars (contracted vs max demanded vs recommended). */
const PowerVerdictCard: React.FC<PowerVerdictCardProps> = ({ analysis }) => {
  const { verdict, periods, hasPrices, totalAnnualSaving } = analysis;

  const periodsWithData = periods.filter((p) => p.maxDemandKw !== null);

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      {verdict === 'lower-possible' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg flex-shrink-0">
            <TrendingDown className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">
              Sí: puedes bajar tu potencia contratada
            </h3>
            <p className="text-sm text-gray-600">
              En el último año nunca te has acercado a la potencia que pagas. Bajándola a la
              recomendada mantendrías un margen de seguridad del 10% sobre tu máximo real.
            </p>
          </div>
          {totalAnnualSaving && (
            <div className="text-center sm:text-right flex-shrink-0">
              <p className="text-3xl font-black text-emerald-600">
                ~{formatCurrency(totalAnnualSaving.total)}
              </p>
              <p className="text-sm font-medium text-emerald-700">de ahorro al año</p>
            </div>
          )}
        </div>
      )}

      {verdict === 'keep' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start gap-4">
          <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Tu potencia está bien ajustada</h3>
            <p className="text-sm text-gray-600">
              La diferencia entre lo que contratas y tu máximo real es tan pequeña que bajarla no
              compensa: te quedarías sin margen de seguridad.
            </p>
          </div>
        </div>
      )}

      {verdict === 'tight' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
          <div className="bg-amber-100 p-3 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Vas al límite: no bajes tu potencia</h3>
            <p className="text-sm text-gray-600">
              En el último año has llegado a demandar tanta potencia como la que tienes contratada
              (o más). Bajarla haría que te &quot;saltaran los plomos&quot; a menudo; incluso vigila
              si te conviene subirla.
            </p>
          </div>
        </div>
      )}

      {verdict === 'no-data' && (
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-6 flex items-start gap-4">
          <div className="bg-gray-200 p-3 rounded-lg flex-shrink-0">
            <Info className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">
              Tu factura no incluye la potencia máxima demandada
            </h3>
            <p className="text-sm text-gray-600">
              El QR de esta factura no trae el dato del maxímetro, así que no podemos darte un
              veredicto automático. Puedes consultarlo en el área de cliente de tu distribuidora o
              usar la calculadora de InvoiceDown del final de la página.
            </p>
          </div>
        </div>
      )}

      {/* Per-period comparison bars */}
      {periodsWithData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Contratada vs. lo que usas</h3>
          <p className="text-sm text-gray-500 mb-6">
            Comparamos la potencia que pagas con la máxima que tu contador ha registrado en el
            último año.
          </p>

          <div className="space-y-8">
            {periodsWithData.map((p) => {
              const scale = (kw: number) => Math.min(Math.round((kw / p.contractedKw) * 100), 100);
              const rows = [
                {
                  label: 'Potencia contratada (lo que pagas)',
                  kw: p.contractedKw,
                  color: 'bg-sky-400',
                },
                {
                  label: 'Máxima que has llegado a usar',
                  kw: p.maxDemandKw as number,
                  color: 'bg-blue-600',
                },
                ...(p.recommendedKw !== null && p.freedKw > 0
                  ? [
                      {
                        label: 'Recomendada (tu máximo + 10% de margen)',
                        kw: p.recommendedKw,
                        color: 'bg-emerald-500',
                      },
                    ]
                  : []),
              ];

              return (
                <div key={p.period}>
                  <p className="text-sm font-bold text-gray-900 mb-3">
                    Periodo {p.label} ({p.period})
                  </p>
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2 text-gray-700">
                            <span className={`w-3 h-3 rounded-full ${row.color}`}></span>
                            {row.label}
                          </span>
                          <span className="font-bold text-gray-900">{formatPower(row.kw)}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                          <div
                            className={`${row.color} h-full rounded-full transition-all duration-700`}
                            style={{ width: `${scale(row.kw)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {!hasPrices && verdict === 'lower-possible' && (
            <div className="mt-6 bg-blue-50/50 p-4 rounded-lg border-l-4 border-primary">
              <p className="text-sm text-gray-700">
                Tu QR no incluye el precio del término de potencia, así que no podemos ponerle euros
                al ahorro. Puedes encontrar el precio en el detalle de tu factura o usar la
                calculadora de InvoiceDown del final de la página.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PowerVerdictCard;

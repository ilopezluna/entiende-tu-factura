/**
 * UnderstandYourInvoice
 *
 * Educational view that explains the user's electricity invoice in plain terms,
 * using the data extracted from their uploaded invoice (QR parameters).
 *
 * Fully client-side and prop-driven: it receives `qrParams` in memory — nothing
 * is fetched or persisted.
 */

import React, { useMemo } from 'react';
import { QrParameters, calculateCostBreakdown, CostBreakdown } from '../lib/cnmc';
import {
  Zap,
  Lightbulb,
  Home,
  ArrowLeft,
  ArrowRight,
  Leaf,
  PowerOff,
  Thermometer,
  TrendingUp,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { formatCurrency, formatCurrencyPerMonth, formatPercentage } from '../utils/formatNumber';
import ContractDetails from './ContractDetails';

const INVOICEDOWN_URL = 'https://www.invoicedown.com/';

interface BreakdownItem {
  label: string;
  caption: string;
  color: string; // tailwind bg class for the dot and the bar
  amount: string; // already formatted
  percentage: number;
}

const BreakdownCard: React.FC<{
  title: string;
  subtitle: string;
  items: BreakdownItem[];
  totalLabel: string;
  totalAmount: string;
}> = ({ title, subtitle, items, totalLabel, totalAmount }) => (
  <div className="bg-gray-900 text-white rounded-xl p-8 md:p-12 shadow-xl overflow-hidden relative">
    <div className="relative z-10">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-gray-400 mb-10 max-w-xl">{subtitle}</p>

      <div className="space-y-8">
        {items.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${item.color}`}></span>
                {item.label}
              </span>
              <span>
                {formatPercentage(item.percentage)}
                <span className="text-gray-400 ml-2 text-xs">({item.amount})</span>
              </span>
            </div>
            <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
              <div
                className={`${item.color} h-full rounded-full transition-all duration-700`}
                style={{ width: `${item.percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 italic">{item.caption}</p>
          </div>
        ))}

        <div className="pt-4 mt-4 border-t border-gray-700 flex justify-between items-center">
          <span className="font-bold text-lg">{totalLabel}</span>
          <span className="font-bold text-xl text-white">{totalAmount}</span>
        </div>
      </div>
    </div>

    {/* Abstract Background Pattern */}
    <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
  </div>
);

interface UnderstandYourInvoiceProps {
  qrParams: QrParameters;
  onReset: () => void;
}

const UnderstandYourInvoice: React.FC<UnderstandYourInvoiceProps> = ({ qrParams, onReset }) => {
  // Compute cost breakdown
  const costBreakdown = useMemo<CostBreakdown>(() => calculateCostBreakdown(qrParams), [qrParams]);

  // Compute breakdown percentages for the visual chart
  const breakdownPercentages = useMemo(() => {
    if (!costBreakdown || costBreakdown.totalMonthlyCost <= 0) {
      return { energy: 45, power: 30, taxes: 25 }; // Fallback
    }
    const total = costBreakdown.totalMonthlyCost;
    const energy = (costBreakdown.monthlyEnergyCost / total) * 100;
    const power = (costBreakdown.monthlyPowerCost / total) * 100;
    const taxes =
      ((costBreakdown.electricityTax + costBreakdown.equipmentFee + costBreakdown.iva) / total) *
      100;
    return {
      energy: Math.round(energy),
      power: Math.round(power),
      taxes: Math.round(taxes),
    };
  }, [costBreakdown]);

  // Actual invoice total (with taxes) vs the averaged monthly estimate.
  const invoiceTotal = qrParams.imp ?? 0;
  const consumptionMonths = Math.round(costBreakdown.actualMonths);
  const periodDays = useMemo(() => {
    if (!qrParams.iniF || !qrParams.finF) return null;
    const start = new Date(qrParams.iniF).getTime();
    const end = new Date(qrParams.finF).getTime();
    if (isNaN(start) || isNaN(end)) return null;
    const days = Math.round((end - start) / 86_400_000);
    return days > 0 ? days : null;
  }, [qrParams.iniF, qrParams.finF]);

  // Per-category amounts billed in THIS invoice (pre-tax for power/energy; the rest
  // — taxes, equipment rental, social bonus… — is the remainder up to the total).
  const powerInvoice = qrParams.impPot > 0 ? qrParams.impPot : null;
  const energyInvoice = qrParams.impEner && qrParams.impEner > 0 ? qrParams.impEner : null;
  const otherInvoice =
    invoiceTotal > 0
      ? Math.max(invoiceTotal - (qrParams.impPot || 0) - (qrParams.impEner || 0), 0)
      : null;

  // Breakdown of the averaged monthly estimate.
  const estimateItems: BreakdownItem[] = [
    {
      label: 'Energía consumida',
      caption: 'Lo que cuesta generar la electricidad que usas.',
      color: 'bg-blue-500',
      amount: formatCurrencyPerMonth(costBreakdown.monthlyEnergyCost),
      percentage: breakdownPercentages.energy,
    },
    {
      label: 'Potencia contratada (fijo)',
      caption: 'El coste fijo por tener la luz disponible en tu casa.',
      color: 'bg-sky-400',
      amount: formatCurrencyPerMonth(costBreakdown.monthlyPowerCost),
      percentage: breakdownPercentages.power,
    },
    {
      label: 'Impuestos y otros',
      caption: 'Impuesto eléctrico, IVA y alquiler del contador.',
      color: 'bg-emerald-400',
      amount: formatCurrencyPerMonth(
        costBreakdown.electricityTax + costBreakdown.equipmentFee + costBreakdown.iva,
      ),
      percentage: breakdownPercentages.taxes,
    },
  ];

  // Breakdown of THIS invoice (proportions over the actual total).
  const invoicePct = (value: number) =>
    invoiceTotal > 0 ? Math.round((value / invoiceTotal) * 100) : 0;
  const invoiceItems: BreakdownItem[] = [];
  if (energyInvoice !== null) {
    invoiceItems.push({
      label: 'Energía consumida',
      caption: 'Lo que cuesta generar la electricidad que usas.',
      color: 'bg-blue-500',
      amount: formatCurrency(energyInvoice),
      percentage: invoicePct(energyInvoice),
    });
  }
  if (powerInvoice !== null) {
    invoiceItems.push({
      label: 'Potencia contratada (fijo)',
      caption: 'El coste fijo por tener la luz disponible en tu casa.',
      color: 'bg-sky-400',
      amount: formatCurrency(powerInvoice),
      percentage: invoicePct(powerInvoice),
    });
  }
  if (otherInvoice !== null) {
    invoiceItems.push({
      label: 'Impuestos y otros',
      caption: 'Impuesto eléctrico, IVA, alquiler del contador y otros conceptos.',
      color: 'bg-emerald-400',
      amount: formatCurrency(otherInvoice),
      percentage: invoicePct(otherInvoice),
    });
  }

  const permanenciaStatus = useMemo(() => {
    const finPen = qrParams.finPen;
    if (!finPen || finPen === '0000-00-00') return null;

    const endDate = new Date(finPen + 'T00:00:00');
    if (isNaN(endDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      isActive: endDate > today,
      formattedDate: endDate.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    };
  }, [qrParams]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-6 h-6" />
              <span className="font-bold tracking-tight uppercase text-sm">Guía de Ahorro</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">
              Entiende tu Factura
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Te explicamos tu factura de luz en lenguaje sencillo, sin tecnicismos ni
              complicaciones.
            </p>
          </div>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Analizar otra factura
          </button>
        </header>

        {/* Summary: actual invoice total vs estimated monthly cost */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoiceTotal > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Total de esta factura
                </p>
                <p className="text-3xl font-black text-gray-900 mt-1">
                  {formatCurrency(invoiceTotal)}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Lo que has pagado en este periodo
                  {periodDays ? ` de ${periodDays} días` : ''}.
                </p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Coste mensual estimado
              </p>
              <p className="text-3xl font-black text-primary mt-1">
                {formatCurrencyPerMonth(costBreakdown.totalMonthlyCost)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Media basada en tu consumo de los últimos {consumptionMonths}{' '}
                {consumptionMonths === 1 ? 'mes' : 'meses'}.
              </p>
            </div>
          </div>
        </section>

        {/* Section 1: ¿Qué estás pagando? */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">¿Qué estás pagando realmente?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Potencia (Fixed) Card */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Home className="w-20 h-20 text-gray-400" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Potencia (Coste Fijo)</h3>
                  <p className="text-sm font-medium text-gray-500 uppercase">
                    Lo que &quot;alquilas&quot;
                  </p>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Es el precio que pagas por tener la potencia disponible en tu casa, aunque no
                enciendas ni una sola bombilla.
              </p>

              <div className="bg-blue-50 p-3 rounded-lg mb-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Coste fijo mensual estimado</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrencyPerMonth(costBreakdown.monthlyPowerCost)}
                  </span>
                </div>
                {qrParams.impPot > 0 && (
                  <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                    <span className="font-medium text-gray-700">Tu coste fijo en esta factura</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(qrParams.impPot)}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50/50 p-4 rounded-lg border-l-4 border-primary">
                <p className="text-sm italic text-gray-700">
                  <strong>La analogía:</strong> Imagina que es el{' '}
                  <strong>alquiler mensual de tus tuberías</strong>. Pagas por tenerlas ahí listas
                  para llevar agua, independientemente de si abres el grifo o no.
                </p>
              </div>
            </div>

            {/* Energía (Variable) Card */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Lightbulb className="w-20 h-20 text-gray-400" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Energía (Coste Variable)</h3>
                  <p className="text-sm font-medium text-gray-500 uppercase">Lo que consumes</p>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Depende de cuántos electrodomésticos uses y por cuánto tiempo estén encendidos
                durante el mes.
              </p>

              <div className="bg-blue-50 p-3 rounded-lg mb-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Coste variable mensual estimado</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrencyPerMonth(costBreakdown.monthlyEnergyCost)}
                  </span>
                </div>
                {qrParams.impEner !== undefined && qrParams.impEner > 0 && (
                  <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                    <span className="font-medium text-gray-700">
                      Tu coste variable en esta factura
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(qrParams.impEner)}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50/50 p-4 rounded-lg border-l-4 border-primary">
                <p className="text-sm italic text-gray-700">
                  <strong>La analogía:</strong> Es como el <strong>agua que consumes</strong>. Si te
                  das una ducha larga o llenas la piscina, pagarás más; si cierras bien el grifo,
                  pagarás menos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Visual Breakdowns — this invoice vs. monthly estimate */}
        <section className="mb-12 space-y-6">
          {invoiceTotal > 0 && invoiceItems.length > 0 && (
            <BreakdownCard
              title="Desglose de esta factura"
              subtitle="Así se reparte cada euro de lo que has pagado en esta factura:"
              items={invoiceItems}
              totalLabel="Total de esta factura"
              totalAmount={formatCurrency(invoiceTotal)}
            />
          )}

          <BreakdownCard
            title="Desglose de tu coste mensual estimado"
            subtitle="Así se repartiría cada euro de tu gasto medio al mes, según tu consumo del último año:"
            items={estimateItems}
            totalLabel="Coste mensual estimado"
            totalAmount={formatCurrencyPerMonth(costBreakdown.totalMonthlyCost)}
          />
        </section>

        {/* Section: Entiende tu Contrato */}
        <ContractDetails qrParams={qrParams} />

        {/* Permanencia Banner */}
        {!permanenciaStatus && (
          <section className="mb-12">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-lg flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">Sin permanencia</h3>
                <p className="text-sm text-gray-600">
                  No hemos detectado un periodo de permanencia en tu contrato. Puedes cambiar de
                  compañía cuando quieras sin coste adicional.
                </p>
              </div>
              <a
                href={INVOICEDOWN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
              >
                Ver ofertas
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </section>
        )}

        {permanenciaStatus && !permanenciaStatus.isActive && (
          <section className="mb-12">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-lg flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">Sin permanencia activa</h3>
                <p className="text-sm text-gray-600">
                  Tu contrato no tiene penalización por baja anticipada. Puedes cambiar de compañía
                  cuando quieras sin coste adicional.
                </p>
              </div>
              <a
                href={INVOICEDOWN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
              >
                Ver ofertas
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </section>
        )}

        {permanenciaStatus && permanenciaStatus.isActive && (
          <section className="mb-12">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-lg flex-shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">
                  Permanencia activa hasta el {permanenciaStatus.formattedDate}
                </h3>
                <p className="text-sm text-gray-600">
                  Tu contrato incluye un periodo de permanencia. Si cambias de compañía antes de esa
                  fecha, podrían aplicarte una penalización. Aun así, puedes consultar ofertas para
                  cuando termine.
                </p>
              </div>
              <a
                href={INVOICEDOWN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-bold text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                Explorar ofertas
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </section>
        )}

        {/* Section 3: Tips para ahorrar */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">Tips rápidos para ahorrar</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tip 1 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-emerald-500/50 transition-colors">
              <Leaf className="w-10 h-10 text-emerald-500 mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">Ajusta tu potencia</h4>
              <p className="text-sm text-gray-600">
                Si nunca te han &quot;saltado los plomos&quot;, quizás tengas contratada más
                potencia de la que necesitas. Bajarla un escalón ahorra mucho al año.
              </p>
            </div>

            {/* Tip 2 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-emerald-500/50 transition-colors">
              <PowerOff className="w-10 h-10 text-emerald-500 mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">Adiós al Stand-by</h4>
              <p className="text-sm text-gray-600">
                La &quot;luz roja&quot; de la tele o el cargador que no usas siguen consumiendo. Usa
                regletas con interruptor para apagarlos del todo.
              </p>
            </div>

            {/* Tip 3 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-emerald-500/50 transition-colors">
              <Thermometer className="w-10 h-10 text-emerald-500 mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">Climatización eficiente</h4>
              <p className="text-sm text-gray-600">
                Cada grado de calefacción o aire acondicionado que subas/bajes puede suponer hasta
                un 7% de incremento en tu consumo de energía.
              </p>
            </div>
          </div>
        </section>

        {/* Footer Call to Action */}
        <footer className="bg-primary rounded-2xl p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">¿Quieres ver cuánto podrías ahorrar hoy?</h3>
            <p className="text-white/80 mb-8">
              En InvoiceDown comparamos entre las mejores comercializadoras para encontrarte la
              tarifa que mejor se adapta a tu consumo real.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={INVOICEDOWN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 bg-white text-primary font-black rounded-xl hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg text-center"
              >
                Comparar ofertas en InvoiceDown
              </a>
            </div>
          </div>

          {/* Background Decoration */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M0,100 C20,80 40,80 60,100 C80,120 100,100 100,100 V0 H0 Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default UnderstandYourInvoice;

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
import {
  QrParameters,
  calculatePeriodDays,
  splitInvoiceAmounts,
  getPermanenciaStatus,
  getCostPerDay,
  formatCurrency,
  formatCurrencyPerDay,
  formatPercentage,
  getConcept,
} from '../lib/cnmc';
import {
  Zap,
  Lightbulb,
  Home,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Leaf,
  PiggyBank,
  TrendingUp,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import ContractDetails from './ContractDetails';

interface BreakdownItem {
  label: string;
  caption: string;
  color: string; // tailwind bg class for the dot and the bar
  amount: string; // already formatted
  percentage: number;
}

/** Plain-language explanation of the billing period, shown next to the dates. */
const PERIOD_EXPLANATION = getConcept('periodo_facturacion')?.explanation ?? null;

/**
 * Official definition of the invoice QR: the CNMC resolution, as published in
 * the BOE, whose Table 1 lists every parameter this app parses.
 */
const QR_SPEC_URL = 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2022-16989';

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
  // Actual invoice total (with taxes) and its billing period length. The total
  // is null when the QR omits it, so an unknown amount never renders as €0.
  const invoiceTotal =
    typeof qrParams.imp === 'number' && Number.isFinite(qrParams.imp) ? qrParams.imp : null;
  const periodDays = useMemo(() => calculatePeriodDays(qrParams), [qrParams]);

  // Average euros per day of this invoice (total ÷ billing days); null unless
  // both figures are present and positive.
  const costPerDay = useMemo(() => getCostPerDay(qrParams), [qrParams]);

  // Human-readable billing period, e.g. «01/11/2025 – 31/12/2025». Gated on
  // periodDays so the range and the day count always agree: both come from
  // iniF/finF and hide together when the period is missing, reversed or empty.
  const periodLabel = useMemo(() => {
    if (periodDays === null || !qrParams.iniF || !qrParams.finF) return null;
    const fmt = (d: string) =>
      new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    return `${fmt(qrParams.iniF)} – ${fmt(qrParams.finF)}`;
  }, [qrParams, periodDays]);

  // Per-category amounts billed in THIS invoice (pre-tax for power/energy; the rest
  // — taxes, equipment rental, social bonus… — is the remainder up to the total).
  const invoiceSplit = useMemo(() => splitInvoiceAmounts(qrParams), [qrParams]);
  const powerInvoice = invoiceSplit.power;
  const energyInvoice = invoiceSplit.energy;
  const otherInvoice = invoiceSplit.other;

  const invoiceItems: BreakdownItem[] = [];
  if (energyInvoice !== null) {
    invoiceItems.push({
      label: 'Energía consumida',
      caption: 'Lo que cuesta generar la electricidad que usas.',
      color: 'bg-blue-500',
      amount: formatCurrency(energyInvoice),
      percentage: invoiceSplit.percentages.energy,
    });
  }
  if (powerInvoice !== null) {
    invoiceItems.push({
      label: 'Potencia contratada (fijo)',
      caption: 'El coste fijo por tener la luz disponible en tu casa.',
      color: 'bg-sky-400',
      amount: formatCurrency(powerInvoice),
      percentage: invoiceSplit.percentages.power,
    });
  }
  if (otherInvoice !== null) {
    invoiceItems.push({
      label: 'Impuestos y otros',
      caption: 'Impuesto eléctrico, IVA, alquiler del contador y otros conceptos.',
      color: 'bg-emerald-400',
      amount: formatCurrency(otherInvoice),
      percentage: invoiceSplit.percentages.taxes,
    });
  }

  const permanenciaStatus = useMemo(() => {
    const status = getPermanenciaStatus(qrParams);
    if (!status) return null;

    return {
      isActive: status.isActive,
      formattedDate: new Date(status.endDate + 'T00:00:00').toLocaleDateString('es-ES', {
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
              Entiende tu factura
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

        {/* Summary: what this invoice costs and the period it covers */}
        <section className="mb-12">
          <div className="bg-blue-50/50 rounded-xl border border-gray-200 border-l-4 border-l-primary shadow-sm p-6 flex flex-col justify-center sm:flex-row sm:items-center sm:justify-center sm:gap-12 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Total de esta factura
              </p>
              <p className="text-4xl md:text-5xl font-black text-primary mt-1">
                {invoiceTotal !== null ? formatCurrency(invoiceTotal) : '—'}
              </p>
              {invoiceTotal === null && (
                <p className="text-sm text-gray-700 mt-2">
                  El QR de esta factura no incluye el total
                </p>
              )}
            </div>

            {costPerDay !== null && (
              <div className="hidden lg:block lg:pl-6 lg:border-l lg:border-blue-200 lg:flex-shrink-0">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Coste por día
                </p>
                <p className="text-2xl xl:text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrencyPerDay(costPerDay)}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-3 sm:pt-0 border-t border-blue-200 sm:border-t-0 sm:border-l sm:border-blue-200 sm:pl-6 sm:flex-shrink-0 sm:max-w-72">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" aria-hidden="true" />
                <p className="text-sm text-gray-700">
                  <span className="font-bold">{periodDays ? `${periodDays} días` : '—'}</span>
                  {periodLabel ? ` · ${periodLabel}` : ''}
                </p>
              </div>
              {PERIOD_EXPLANATION && (
                <p className="text-xs leading-relaxed text-gray-500">{PERIOD_EXPLANATION}</p>
              )}
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

              {qrParams.impPot > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">Tu coste fijo en esta factura</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(qrParams.impPot)}
                    </span>
                  </div>
                </div>
              )}

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

              {qrParams.impEner !== undefined && qrParams.impEner > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">
                      Tu coste variable en esta factura
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(qrParams.impEner)}
                    </span>
                  </div>
                </div>
              )}

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

        {/* Section 2: Visual breakdown of this invoice */}
        <section className="mb-12">
          {invoiceTotal !== null && invoiceTotal > 0 && invoiceItems.length > 0 && (
            <BreakdownCard
              title="Desglose de esta factura"
              subtitle="Así se reparte cada euro de lo que has pagado en esta factura:"
              items={invoiceItems}
              totalLabel="Total de esta factura"
              totalAmount={formatCurrency(invoiceTotal)}
            />
          )}
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
              <a
                href="#/bajar-potencia"
                className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Analiza tu potencia con esta misma factura
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Tip 2 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-emerald-500/50 transition-colors">
              <PiggyBank className="w-10 h-10 text-emerald-500 mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">Compara y cambia de tarifa</h4>
              <p className="text-sm text-gray-600">
                Las comercializadoras cambian sus precios constantemente. Comparar entre ofertas es
                la forma más rápida de dejar de pagar de más por la misma luz.
              </p>
            </div>

            {/* Tip 3 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-emerald-500/50 transition-colors">
              <Clock className="w-10 h-10 text-emerald-500 mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">¿Tienes contrato regulado?</h4>
              <p className="text-sm text-gray-600">
                En el mercado regulado (PVPC) el precio de la luz cambia cada hora del día. Vigílalo
                y concentra el consumo en las horas más baratas para ahorrar.
              </p>
            </div>
          </div>
        </section>

        {/* Footnote: where the data comes from. External navigation only —
            the invoice data itself never leaves the browser. */}
        <footer className="mt-16 pb-4 text-center">
          <p className="text-xs text-gray-400 max-w-xl mx-auto leading-relaxed">
            Todos los datos de esta página salen del código QR oficial de tu factura y se quedan en
            tu navegador. Lo que debe traer ese QR lo define la CNMC en{' '}
            <a
              href={QR_SPEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 transition-colors"
            >
              esta resolución publicada en el BOE
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
};

export default UnderstandYourInvoice;

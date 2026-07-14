import React, { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Droplets,
  History,
  PiggyBank,
  Receipt,
  TrendingDown,
  Unplug,
} from 'lucide-react';
import FileUpload from '../components/FileUpload';
import PrivacyBanner from '../components/invoice-flow/PrivacyBanner';
import QrFlowSteps from '../components/invoice-flow/QrFlowSteps';
import PowerVerdictCard from '../components/power/PowerVerdictCard';
import PowerSimulator from '../components/power/PowerSimulator';
import SavingsMathCard from '../components/power/SavingsMathCard';
import { Button } from '../components/ui';
import { QrParameters, analyzePower, POWER_CHANGE_FEE_EUR } from '../lib/cnmc';
import { useInvoiceQr } from '../hooks/useInvoiceQr';
import { formatCurrency } from '../utils/formatNumber';
import { INVOICEDOWN_POTENCIA_URL } from '../constants';

interface LowerPowerPageProps {
  qrParams: QrParameters | null;
  onQrParams: (qrParams: QrParameters) => void;
  onResetInvoice: () => void;
}

/**
 * Standalone page (#/bajar-potencia): explains what contracted power is and,
 * with an invoice, tells the user whether they can lower it and how much they
 * would save — with the full calculation exposed. Fully client-side.
 */
const LowerPowerPage: React.FC<LowerPowerPageProps> = ({
  qrParams,
  onQrParams,
  onResetInvoice,
}) => {
  const flow = useInvoiceQr(onQrParams);

  const analysis = useMemo(() => (qrParams ? analyzePower(qrParams) : null), [qrParams]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '¿Puedes bajar tu potencia? | Entiende tu factura de la luz';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <TrendingDown className="w-6 h-6" />
              <span className="font-bold tracking-tight uppercase text-sm">Guía de Ahorro</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">
              ¿Puedes bajar tu potencia contratada?
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              La mayoría de hogares paga por más potencia de la que usa. Te explicamos qué es, por
              qué importa y — con tu factura — te decimos si puedes bajarla y cuánto ahorrarías.
            </p>
          </div>
          <a
            href="#/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a entender tu factura
          </a>
        </header>

        {/* Didactic section: what is contracted power and why it matters */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">
              ¿Qué es la potencia contratada y por qué te cuesta dinero?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <Droplets className="w-10 h-10 text-primary mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">El grosor de tu tubería</h4>
              <p className="text-sm text-gray-600 mb-4">
                La potencia (kW) es cuánta electricidad puedes usar <strong>a la vez</strong>: es lo
                que decide si puedes poner el horno, la lavadora y el aire acondicionado al mismo
                tiempo sin que &quot;salten los plomos&quot;.
              </p>
              <div className="bg-blue-50/50 p-3 rounded-lg border-l-4 border-primary">
                <p className="text-xs italic text-gray-700">
                  <strong>La analogía:</strong> si la energía es el agua que consumes, la potencia
                  es el <strong>grosor de la tubería</strong>. Pagas por ese grosor cada día, aunque
                  no abras el grifo.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <History className="w-10 h-10 text-primary mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">
                Casi nadie la revisa (y suele sobrar)
              </h4>
              <p className="text-sm text-gray-600">
                Muchos contratos heredan la potencia de hace décadas, cuando se contrataba &quot;por
                si acaso&quot; y los contadores antiguos no medían nada. Hoy tu contador inteligente
                registra la potencia máxima que has usado de verdad — y en la mayoría de hogares
                está muy por debajo de la contratada.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <PiggyBank className="w-10 h-10 text-primary mb-4" />
              <h4 className="font-bold text-lg mb-2 text-gray-900">
                Bajarla ahorra todos los días
              </h4>
              <p className="text-sm text-gray-600">
                La potencia es un <strong>coste fijo</strong>: la pagas los 365 días del año, uses o
                no la luz. Cada 0,1 kW que liberas es un ahorro pequeño pero{' '}
                <strong>permanente</strong> — se nota en todas las facturas que vienen, sin cambiar
                ningún hábito.
              </p>
            </div>
          </div>
        </section>

        {/* Analysis: upload or verdict */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">Tu análisis personalizado</h2>
          </div>

          {!qrParams && flow.step === 'upload' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-6 md:p-12 shadow-card">
                <h3 className="text-2xl font-bold text-center text-gray-900 mb-3">
                  Sube tu factura para analizarla
                </h3>
                <p className="text-sm text-gray-600 text-center mb-8">
                  Leemos el QR oficial de la CNMC que trae tu factura: ahí viene tu potencia
                  contratada y la máxima que has llegado a usar en el último año.
                </p>

                <PrivacyBanner />

                {flow.pdfLibError ? (
                  <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <p className="subtitle">No se pudo cargar el procesador de PDF</p>
                    <p className="error-message">{flow.pdfLibError}</p>
                    <Button onClick={() => window.location.reload()} variant="primary" size="md">
                      Recargar página
                    </Button>
                  </div>
                ) : (
                  <FileUpload onFileSelect={flow.handleFileSelect} />
                )}
              </div>
            </div>
          )}

          {!qrParams && <QrFlowSteps flow={flow} />}

          {qrParams && analysis && (
            <div className="space-y-6">
              <PowerVerdictCard analysis={analysis} />
              {analysis.hasPrices && analysis.hasMaxDemand && (
                <PowerSimulator qrParams={qrParams} analysis={analysis} />
              )}
              {analysis.verdict === 'lower-possible' && analysis.totalAnnualSaving && (
                <SavingsMathCard analysis={analysis} />
              )}
              <div className="text-center">
                <button
                  onClick={onResetInvoice}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Analizar otra factura
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Honest fine print */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-amber-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">La letra pequeña, sin esconder</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex gap-4">
              <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-gray-900 mb-1">El dato es del último año</h4>
                <p className="text-sm text-gray-600">
                  La potencia máxima del QR mira hacia atrás. Si acabas de mudarte, o vas a añadir
                  aire acondicionado, coche eléctrico o cocina de inducción, ese máximo se quedará
                  corto: tenlo en cuenta antes de bajar.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex gap-4">
              <Receipt className="w-8 h-8 text-amber-500 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-gray-900 mb-1">Tiene un coste único (pequeño)</h4>
                <p className="text-sm text-gray-600">
                  Bajar la potencia paga unos derechos de enganche de unos{' '}
                  {formatCurrency(POWER_CHANGE_FEE_EUR)} (9,04€ + IVA). Si el ahorro anual es real,
                  se amortiza en pocos meses.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex gap-4">
              <CalendarClock className="w-8 h-8 text-amber-500 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-gray-900 mb-1">Un cambio al año, normalmente</h4>
                <p className="text-sm text-gray-600">
                  Por norma general solo se permite un cambio de potencia cada 12 meses. Algunas
                  distribuidoras son más flexibles, pero no cuentes con ello: decide con calma.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex gap-4">
              <Unplug className="w-8 h-8 text-amber-500 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-gray-900 mb-1">
                  Si te quedas corto, se corta la luz
                </h4>
                <p className="text-sm text-gray-600">
                  Cuando superas la potencia contratada, el ICP corta el suministro: no rompe nada,
                  pero toca ir al cuadro eléctrico a rearmar. Por eso recomendamos siempre un margen
                  del 10% sobre tu máximo real.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Call to Action */}
        <footer className="bg-primary rounded-2xl p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">¿Quieres afinar aún más tu potencia?</h3>
            <p className="text-white/80 mb-8">
              La calculadora de potencia óptima de InvoiceDown tiene en cuenta tus electrodomésticos
              y hábitos para recomendarte la potencia exacta.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={INVOICEDOWN_POTENCIA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary font-black rounded-xl hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg text-center"
              >
                Calcula tu potencia óptima en InvoiceDown
                <ArrowRight className="w-5 h-5" />
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

export default LowerPowerPage;

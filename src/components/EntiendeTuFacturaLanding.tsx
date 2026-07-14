import React from 'react';
import { TrendingDown, ArrowRight } from 'lucide-react';
import FileUpload from './FileUpload';
import UnderstandYourInvoice from './UnderstandYourInvoice';
import PrivacyBanner from './invoice-flow/PrivacyBanner';
import QrFlowSteps from './invoice-flow/QrFlowSteps';
import { Button } from './ui';
import { QrParameters } from '../lib/cnmc';
import { useInvoiceQr } from '../hooks/useInvoiceQr';

interface EntiendeTuFacturaLandingProps {
  qrParams: QrParameters | null;
  onQrParams: (qrParams: QrParameters) => void;
  onResetInvoice: () => void;
}

const EntiendeTuFacturaLanding: React.FC<EntiendeTuFacturaLandingProps> = ({
  qrParams,
  onQrParams,
  onResetInvoice,
}) => {
  const flow = useInvoiceQr(onQrParams);

  if (qrParams) {
    return <UnderstandYourInvoice qrParams={qrParams} onReset={onResetInvoice} />;
  }

  return (
    <div>
      {flow.step === 'upload' && (
        <>
          <h1 className="sr-only">
            Entiende tu factura de luz: desglose claro de cada euro que pagas
          </h1>

          {/* Features strip */}
          <section className="hidden md:block py-12 px-4 bg-white border-y border-gray-200">
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Desglose Visual</h3>
                  <p className="text-sm text-gray-600">Qué pagas y por qué</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🔒</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">100% Privado</h3>
                  <p className="text-sm text-gray-600">Datos en tu navegador</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Instantáneo</h3>
                  <p className="text-sm text-gray-600">Resultado en segundos</p>
                </div>
              </div>
            </div>
          </section>

          {/* Upload */}
          <section id="upload-section" className="py-8 md:py-24 px-4 bg-gray-50">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl p-6 md:p-12 shadow-card">
                <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
                  Sube tu factura de luz
                </h2>

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

              {/* Discoverability: lower-power analysis page */}
              <a
                href="#/bajar-potencia"
                className="block bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-3 rounded-lg flex-shrink-0">
                    <TrendingDown className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">¿Pagas de más por tu potencia?</h3>
                    <p className="text-sm text-gray-600">
                      Descubre con tu factura si puedes bajar la potencia contratada y cuánto
                      ahorrarías al año.
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                </div>
              </a>
            </div>
          </section>
        </>
      )}

      <QrFlowSteps flow={flow} />
    </div>
  );
};

export default EntiendeTuFacturaLanding;

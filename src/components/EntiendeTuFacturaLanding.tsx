import React, { useState, useEffect } from 'react';
import FileUpload from './FileUpload';
import QrManualSelector from './QrManualSelector';
import UnderstandYourInvoice from './UnderstandYourInvoice';
import { Button } from './ui';
import { QrParameters, parseQrParameters } from '../lib/cnmc';
import { extractCnmcUrl, isCNMCUrl, loadPdfJs } from '../lib/cnmc/extraction';
import { CropArea, fileToDataUrl, cropImageToFile, cropPdfToFile } from '../utils/imageProcessing';

interface LandingState {
  step: 'upload' | 'processing' | 'manual-selection' | 'processing-crop' | 'result' | 'error';
  qrParams?: QrParameters;
  error?: string;
  originalFile?: File;
  imageDataUrl?: string;
  manualAttempted?: boolean;
}

const EntiendeTuFacturaLanding: React.FC = () => {
  const [state, setState] = useState<LandingState>({ step: 'upload' });
  const [isPdfLibReady, setIsPdfLibReady] = useState(false);
  const [pdfLibError, setPdfLibError] = useState<string | null>(null);

  useEffect(() => {
    loadPdfJs()
      .then(() => setIsPdfLibReady(true))
      .catch((e: unknown) => {
        setPdfLibError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  useEffect(() => {
    if (state.step === 'processing') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.step]);

  const handleFileSelect = async (file: File) => {
    if (file.type === 'application/pdf' && !isPdfLibReady) {
      setState({
        step: 'error',
        error: 'Todavía estamos cargando el lector PDF. Intenta de nuevo en unos segundos.',
      });
      return;
    }
    setState({ step: 'processing', originalFile: file });

    try {
      const validUrl = await extractCnmcUrl(file, isCNMCUrl);
      if (!isCNMCUrl(validUrl)) {
        throw new Error(`URL is not from CNMC comparator. Received URL: ${validUrl}`);
      }

      const qrParams = parseQrParameters(validUrl);
      setState({ step: 'result', qrParams, originalFile: file });
    } catch (error) {
      console.warn('Automatic QR detection failed:', error);
      try {
        const imageDataUrl = await fileToDataUrl(file);
        setState({
          step: 'manual-selection',
          originalFile: file,
          imageDataUrl,
          manualAttempted: false,
        });
      } catch {
        setState({
          step: 'error',
          error: error instanceof Error ? error.message : 'Error al procesar la factura',
        });
      }
    }
  };

  const handleCropConfirm = async (cropArea: CropArea) => {
    if (!state.imageDataUrl || !state.originalFile) return;
    setState((prev) => ({ ...prev, step: 'processing-crop' }));

    try {
      const croppedFile =
        state.originalFile.type === 'application/pdf'
          ? await cropPdfToFile(state.originalFile, cropArea, state.originalFile.name)
          : await cropImageToFile(state.imageDataUrl, cropArea, state.originalFile.name);

      const validUrl = await extractCnmcUrl(croppedFile, isCNMCUrl);
      if (!isCNMCUrl(validUrl)) {
        throw new Error(`URL is not from CNMC comparator. Received URL: ${validUrl}`);
      }

      const qrParams = parseQrParameters(validUrl);
      setState({ step: 'result', qrParams, originalFile: state.originalFile });
    } catch (error) {
      console.warn('Manual QR detection failed:', error);
      if (state.manualAttempted) {
        setState({
          step: 'error',
          error: 'No pudimos encontrar el código QR. Asegúrate de que el QR sea visible y legible.',
        });
      } else {
        setState((prev) => ({ ...prev, step: 'manual-selection', manualAttempted: true }));
      }
    }
  };

  const handleManualSelectionCancel = () => {
    setState({
      step: 'error',
      error:
        'No pudimos detectar el código QR. Si tu factura tiene un código QR válido, por favor intenta de nuevo.',
    });
  };

  const reset = () => setState({ step: 'upload' });

  if (state.step === 'result' && state.qrParams) {
    return <UnderstandYourInvoice qrParams={state.qrParams} onReset={reset} />;
  }

  return (
    <div>
      {state.step === 'upload' && (
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
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-6 md:p-12 shadow-card">
                <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
                  Sube tu factura de luz
                </h2>

                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex gap-3 items-center">
                    <span className="text-2xl">🔒</span>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <span className="font-semibold">100% privado:</span> nada sale de tu
                      navegador.
                    </p>
                  </div>
                </div>

                {pdfLibError ? (
                  <div className="error-container">
                    <div className="error-icon">⚠️</div>
                    <p className="subtitle">No se pudo cargar el procesador de PDF</p>
                    <p className="error-message">{pdfLibError}</p>
                    <Button onClick={() => window.location.reload()} variant="primary" size="md">
                      Recargar página
                    </Button>
                  </div>
                ) : (
                  <FileUpload onFileSelect={handleFileSelect} />
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {state.step === 'processing' && (
        <div className="loading-screen">
          <div className="loading">
            <div className="spinner"></div>
            <p>Procesando tu factura...</p>
          </div>
        </div>
      )}

      {state.step === 'manual-selection' && state.imageDataUrl && (
        <div className="onboarding-section onboarding-section-wide">
          <QrManualSelector
            imageDataUrl={state.imageDataUrl}
            onCropConfirm={handleCropConfirm}
            onCancel={handleManualSelectionCancel}
            isProcessing={false}
          />
          {state.manualAttempted && (
            <div className="manual-retry-notice">
              <p>
                ⚠️ No encontramos el QR en el área anterior. Intenta seleccionar un área diferente
                que incluya completamente el código QR.
              </p>
            </div>
          )}
        </div>
      )}

      {state.step === 'processing-crop' && (
        <div className="loading-screen">
          <div className="loading">
            <div className="spinner"></div>
            <p>Buscando código QR...</p>
            <p className="loading-subtext">Analizando el área seleccionada</p>
          </div>
        </div>
      )}

      {state.step === 'error' && (
        <div className="onboarding-section">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h3>Error al procesar la factura</h3>
            <p className="error-message">{state.error}</p>
            <Button onClick={reset} variant="primary" size="md">
              Intentar de nuevo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntiendeTuFacturaLanding;

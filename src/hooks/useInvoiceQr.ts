import { useEffect, useState } from 'react';
import { QrParameters, parseQrParameters } from '../lib/cnmc';
import { extractCnmcUrl, isCNMCUrl, loadPdfJs } from '../lib/cnmc/extraction';
import { CropArea, fileToDataUrl, cropImageToFile, cropPdfToFile } from '../utils/imageProcessing';

export type InvoiceQrStep =
  'upload' | 'processing' | 'manual-selection' | 'processing-crop' | 'error';

interface InvoiceQrState {
  step: InvoiceQrStep;
  error?: string;
  originalFile?: File;
  imageDataUrl?: string;
  manualAttempted?: boolean;
}

export interface UseInvoiceQrResult {
  step: InvoiceQrStep;
  error?: string;
  imageDataUrl?: string;
  manualAttempted: boolean;
  isPdfLibReady: boolean;
  pdfLibError: string | null;
  handleFileSelect: (file: File) => Promise<void>;
  handleCropConfirm: (cropArea: CropArea) => Promise<void>;
  handleManualSelectionCancel: () => void;
  reset: () => void;
}

/**
 * Upload → QR extraction state machine shared by every page that accepts an
 * invoice: automatic QR detection with a manual crop fallback (one retry).
 * On success it hands the parsed QrParameters to `onSuccess` and returns to
 * the 'upload' step; the caller decides what to render with the result.
 *
 * All state is in-memory only; unmounting mid-flow discards the progress
 * (deliberate: no persistence anywhere in the app).
 */
export function useInvoiceQr(onSuccess: (qrParams: QrParameters) => void): UseInvoiceQrResult {
  const [state, setState] = useState<InvoiceQrState>({ step: 'upload' });
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
      setState({ step: 'upload' });
      onSuccess(qrParams);
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
      } catch (conversionError) {
        console.warn('Preview conversion for manual selection failed:', conversionError);
        // Deliberately report the extraction error (not the conversion one):
        // it's the message that tells the user why their QR couldn't be read.
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
      setState({ step: 'upload' });
      onSuccess(qrParams);
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

  return {
    step: state.step,
    error: state.error,
    imageDataUrl: state.imageDataUrl,
    manualAttempted: state.manualAttempted ?? false,
    isPdfLibReady,
    pdfLibError,
    handleFileSelect,
    handleCropConfirm,
    handleManualSelectionCancel,
    reset,
  };
}

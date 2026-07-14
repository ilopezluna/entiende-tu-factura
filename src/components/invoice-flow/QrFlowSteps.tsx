import React from 'react';
import QrManualSelector from '../QrManualSelector';
import { Button } from '../ui';
import { UseInvoiceQrResult } from '../../hooks/useInvoiceQr';

interface QrFlowStepsProps {
  flow: UseInvoiceQrResult;
}

/**
 * Renders the non-upload steps of the invoice QR flow (processing, manual QR
 * selection, crop processing, error). Returns null on the 'upload' step: each
 * page provides its own upload block (PrivacyBanner + FileUpload) with its own
 * framing.
 */
const QrFlowSteps: React.FC<QrFlowStepsProps> = ({ flow }) => {
  if (flow.step === 'processing') {
    return (
      <div className="loading-screen">
        <div className="loading">
          <div className="spinner"></div>
          <p>Procesando tu factura...</p>
        </div>
      </div>
    );
  }

  if (flow.step === 'manual-selection' && flow.imageDataUrl) {
    return (
      <div className="onboarding-section onboarding-section-wide">
        <QrManualSelector
          imageDataUrl={flow.imageDataUrl}
          onCropConfirm={flow.handleCropConfirm}
          onCancel={flow.handleManualSelectionCancel}
          isProcessing={false}
        />
        {flow.manualAttempted && (
          <div className="manual-retry-notice">
            <p>
              ⚠️ No encontramos el QR en el área anterior. Intenta seleccionar un área diferente que
              incluya completamente el código QR.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (flow.step === 'processing-crop') {
    return (
      <div className="loading-screen">
        <div className="loading">
          <div className="spinner"></div>
          <p>Buscando código QR...</p>
          <p className="loading-subtext">Analizando el área seleccionada</p>
        </div>
      </div>
    );
  }

  if (flow.step === 'error') {
    return (
      <div className="onboarding-section">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Error al procesar la factura</h3>
          <p className="error-message">{flow.error}</p>
          <Button onClick={flow.reset} variant="primary" size="md">
            Intentar de nuevo
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default QrFlowSteps;

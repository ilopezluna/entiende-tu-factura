import { useState } from 'react';
import EntiendeTuFacturaLanding from './components/EntiendeTuFacturaLanding';
import LowerPowerPage from './pages/LowerPowerPage';
import OpenSourceBanner from './components/OpenSourceBanner';
import { QrParameters } from './lib/cnmc';
import { useHashRoute } from './hooks/useHashRoute';

/**
 * App owns the scanned invoice data (in memory only, no persistence) so both
 * pages can share it: scanning on one page makes the other analyze the same
 * invoice without re-uploading.
 */
function App() {
  const route = useHashRoute();
  const [qrParams, setQrParams] = useState<QrParameters | null>(null);
  const resetInvoice = () => setQrParams(null);

  if (route === '/bajar-potencia') {
    return (
      <>
        <OpenSourceBanner />
        <LowerPowerPage
          qrParams={qrParams}
          onQrParams={setQrParams}
          onResetInvoice={resetInvoice}
        />
      </>
    );
  }

  return (
    <>
      <OpenSourceBanner />
      <EntiendeTuFacturaLanding
        qrParams={qrParams}
        onQrParams={setQrParams}
        onResetInvoice={resetInvoice}
      />
    </>
  );
}

export default App;

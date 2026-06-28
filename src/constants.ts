/** URL del repositorio de código fuente del proyecto. */
export const SOURCE_REPO_URL = 'https://github.com/ilopezluna/entiende-tu-factura';

/** Base de InvoiceDown (comparador de tarifas al que derivamos tráfico). */
const INVOICEDOWN_BASE = 'https://www.invoicedown.com';

/**
 * UTM de salida para que InvoiceDown pueda atribuir el tráfico que le enviamos
 * desde esta web. Si lanzas otra campaña, cambia `utm_campaign`.
 */
const INVOICEDOWN_UTM = 'utm_source=entiende-tu-factura&utm_medium=referral&utm_campaign=vatio-01';

/**
 * Normaliza un valor de UTM a un token corto y seguro: minúsculas, solo
 * `[a-z0-9_-]` y máximo 32 caracteres. Evita reenviar a InvoiceDown valores
 * inesperados o sensibles que un usuario haya colado en la URL de entrada.
 */
function safeChannelToken(value: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

/**
 * Canal con el que llegó el visitante (utm_source[/utm_medium] de la URL actual),
 * para reenviarlo a InvoiceDown y poder atribuir la conversión por canal
 * (p. ej. `reddit_cpc`). Se calcula en el navegador leyendo `location.search`:
 * NO se envía nada a ningún servidor, solo se reescribe el enlace de salida.
 */
function inboundChannel(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const source = safeChannelToken(params.get('utm_source'));
  if (!source) return '';
  const medium = safeChannelToken(params.get('utm_medium'));
  return medium ? `${source}_${medium}` : source;
}

/**
 * Construye una URL de InvoiceDown con los UTM de salida y el canal de entrada.
 * `path` empieza por `/` (por defecto la raíz) para no provocar un redirect
 * innecesario que podría descartar los query params.
 */
const invoiceDownUrl = (path = '/'): string => {
  const channel = inboundChannel();
  const utm = channel
    ? `${INVOICEDOWN_UTM}&utm_content=${encodeURIComponent(channel)}`
    : INVOICEDOWN_UTM;
  return `${INVOICEDOWN_BASE}${path}?${utm}`;
};

export const INVOICEDOWN_URL = invoiceDownUrl();
export const INVOICEDOWN_POTENCIA_URL = invoiceDownUrl('/calculadora-potencia-optima');
export const INVOICEDOWN_PRECIO_LUZ_URL = invoiceDownUrl('/precio-luz');

/** URL del repositorio de código fuente del proyecto. */
export const SOURCE_REPO_URL = 'https://github.com/ilopezluna/entiende-tu-factura';

/** Base de InvoiceDown (comparador de tarifas al que derivamos tráfico). */
const INVOICEDOWN_BASE = 'https://www.invoicedown.com';

/**
 * UTM de salida para que InvoiceDown pueda atribuir el tráfico que le enviamos
 * desde esta web. Si lanzas otra campaña, cambia `utm_campaign`.
 */
const INVOICEDOWN_UTM = 'utm_source=entiende-tu-factura&utm_medium=referral&utm_campaign=vatio-01';

/** Construye una URL de InvoiceDown con los parámetros UTM de salida. */
const invoiceDownUrl = (path = ''): string => `${INVOICEDOWN_BASE}${path}?${INVOICEDOWN_UTM}`;

export const INVOICEDOWN_URL = invoiceDownUrl();
export const INVOICEDOWN_POTENCIA_URL = invoiceDownUrl('/calculadora-potencia-optima');
export const INVOICEDOWN_PRECIO_LUZ_URL = invoiceDownUrl('/precio-luz');

/** Evento de conversión (clic saliente a InvoiceDown) que registramos en Umami. */
export const INVOICEDOWN_CLICK_EVENT = 'invoicedown_click';

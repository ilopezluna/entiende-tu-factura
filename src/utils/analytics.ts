/**
 * Analítica sin cookies (Umami).
 *
 * El script de Umami se carga desde `index.html` y expone `window.umami`. Puede
 * no existir (bloqueadores, entorno de desarrollo sin script configurado), por lo
 * que toda llamada es defensiva y nunca rompe la app.
 */

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

/** Registra un evento en Umami si está disponible. No-op en caso contrario. */
export function trackEvent(event: string, data?: Record<string, unknown>): void {
  try {
    window.umami?.track(event, data);
  } catch {
    /* la analítica nunca debe afectar a la experiencia del usuario */
  }
}

import React from 'react';
import { SOURCE_REPO_URL } from '../constants';

/**
 * Banner fijo en la parte superior de todas las páginas: anuncia que el
 * proyecto es open source y enlaza al repositorio de código fuente.
 */
const OpenSourceBanner: React.FC = () => (
  <a
    href={SOURCE_REPO_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Entiende tu factura es open source: ver el repositorio en GitHub (se abre en una pestaña nueva)"
    className="block w-full bg-gray-900 text-gray-200 text-center text-sm px-4 py-2 hover:bg-gray-800 focus-visible:bg-gray-800 transition-colors"
  >
    <span className="font-semibold text-white">♥ Open source:</span> el código de este proyecto es
    público y está disponible en{' '}
    <span className="font-medium underline underline-offset-2">GitHub</span>
  </a>
);

export default OpenSourceBanner;

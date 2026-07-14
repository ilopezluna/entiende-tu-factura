import React from 'react';
import { SOURCE_REPO_URL } from '../../constants';

/**
 * "100% privado" banner shown next to every invoice uploader, with a link to
 * the source code so users can verify that nothing leaves their browser.
 */
const PrivacyBanner: React.FC = () => (
  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex gap-3 items-center">
      <span className="text-2xl">🔒</span>
      <p className="text-sm text-blue-800 leading-relaxed">
        <span className="font-semibold">100% privado:</span> nada sale de tu navegador.{' '}
        <span className="block mt-1">
          ¿No te lo acabas de creer?{' '}
          <a
            href={SOURCE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver el código del proyecto en GitHub (se abre en una pestaña nueva)"
            className="font-medium text-primary hover:underline focus-visible:underline"
          >
            Aquí puedes ver el código del proyecto
          </a>
        </span>
      </p>
    </div>
  </div>
);

export default PrivacyBanner;

import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

/**
 * Server-side entry used only at build time (see `vite-prerender-plugin.ts`):
 * renders the initial app tree so the landing markup lands in the built
 * `index.html` and crawlers see real content without executing JavaScript.
 *
 * Must stay free of browser APIs at render time (tests enforce this in
 * `src/prerender.test.ts`).
 */
export function render(): string {
  return renderToStaticMarkup(<App />);
}

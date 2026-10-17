import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

/**
 * The build prerenders the landing into `dist/index.html` (see
 * `vite-prerender-plugin.ts`). This test keeps `App` safe to render in Node
 * (no browser APIs at render time: the node environment has no `window`) and
 * asserts that the static HTML carries the content crawlers should index.
 */
describe('prerender', () => {
  it('renders the landing markup in Node, defaulting to the landing route', () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain('Entiende tu factura de luz');
    expect(markup).toContain('100% Privado');
    expect(markup).toContain('bajar la potencia contratada');
  });
});

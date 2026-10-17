import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const ROOT_MARKER = '<div id="root"></div>';

/**
 * Build-time prerender of the landing page.
 *
 * After `vite build` writes `dist/index.html`, this plugin spins up an
 * in-memory Vite dev server (middleware mode), SSR-loads `/src/prerender.tsx`
 * and inlines the rendered markup into the `#root` div of the emitted HTML.
 *
 * The client entry (`src/main.tsx`) is unchanged: it keeps using `createRoot`,
 * which replaces the static markup with the live app. The static payload is
 * only what crawlers and first paint see.
 */
export function prerenderPlugin(): Plugin {
  let htmlPath = join('dist', 'index.html');

  return {
    name: 'prerender-landing',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      htmlPath = join(config.root, config.build.outDir, 'index.html');
    },
    async closeBundle() {
      const { createServer } = await import('vite');
      const server = await createServer({
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true },
      });
      try {
        const { render } = (await server.ssrLoadModule('/src/prerender.tsx')) as {
          render: () => string;
        };
        const html = await readFile(htmlPath, 'utf8');
        if (!html.includes(ROOT_MARKER)) {
          throw new Error(`prerender: ${ROOT_MARKER} not found in ${htmlPath}`);
        }
        await writeFile(htmlPath, html.replace(ROOT_MARKER, `<div id="root">${render()}</div>`));
      } finally {
        await server.close();
      }
    },
  };
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative base so the build works on GitHub Pages project sites
  // (served from /<repo>/) and on custom domains without changes.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks for better caching.
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/pdfjs-dist')) return 'vendor-pdfjs';
          if (id.includes('node_modules/jsqr')) return 'vendor-jsqr';
        },
      },
    },
  },
  optimizeDeps: {
    // pdfjs-dist ships its own worker; let Vite handle it lazily.
    exclude: ['pdfjs-dist'],
  },
  server: {
    port: 5173,
  },
});

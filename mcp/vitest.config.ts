import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Rendering PDFs at high scales is slow the first time pdfjs warms up.
    testTimeout: 30000,
  },
});

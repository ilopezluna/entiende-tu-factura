import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  // The shared CNMC domain modules live outside this package and are pulled in
  // by relative import, so the published bundle is self-contained.
  bundle: true,
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
});

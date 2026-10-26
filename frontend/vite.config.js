import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Browser-only lab: no API proxy. The app imports the repository's own content, samples, infra
// and workflows at build time (src/kb/repo.js), so the dev server may read the parent folder.
export default defineConfig({
  plugins: [react()],
  // Dev server: localhost only, port from VITE_PORT (Vite's default when unset)
  server: {
    port: Number(process.env.VITE_PORT) || undefined,
    fs: { allow: ['..'] }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    testTimeout: 20000
  }
});

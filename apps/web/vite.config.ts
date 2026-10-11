import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// En developpement, Vite proxifie /api vers l API : meme origine, comme la reecriture Vercel en production (ADR-006, ADR-038).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Ports surchargeables (WEB_PORT, API_PROXY_TARGET) pour que la CI auto-hébergée ne heurte pas le poste de dev.
  server: {
    port: Number.parseInt(process.env['WEB_PORT'] ?? '5173', 10),
    strictPort: true,
    proxy: { '/api': process.env['API_PROXY_TARGET'] ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

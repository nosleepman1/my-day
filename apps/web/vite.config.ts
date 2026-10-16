import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** PWA (FRONTEND.md §10) : service worker maison (`src/sw.ts`), mise à jour sur invite, jamais de cache `/api`. */
const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'prompt',
  injectRegister: false,
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'] },
  devOptions: { enabled: false },
  manifest: {
    name: 'ORBIT',
    short_name: 'ORBIT',
    lang: 'fr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F7F9',
    theme_color: '#2B4BC0',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Dépense',
        short_name: 'Dépense',
        url: '/capture?type=expense&source=shortcut',
        icons: [{ src: '/icons/shortcut-expense.png', sizes: '96x96' }],
      },
      {
        name: 'Idée',
        short_name: 'Idée',
        url: '/capture?type=idea&source=shortcut',
        icons: [{ src: '/icons/shortcut-idea.png', sizes: '96x96' }],
      },
    ],
    share_target: { action: '/capture', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
  },
});

/** Version du build : SHA fourni par Vercel, contrôlé par les smoke tests (INFRASTRUCTURE.md §6.5, §8.6). */
const APP_VERSION = process.env['VERCEL_GIT_COMMIT_SHA'] ?? process.env['VITE_APP_VERSION'] ?? 'dev';

const versionMeta: Plugin = {
  name: 'orbit:version-meta',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'orbit-version', content: APP_VERSION }, injectTo: 'head' },
  ],
};

const devPort = Number.parseInt(process.env['WEB_PORT'] ?? '5173', 10);
const apiProxy = { '/api': process.env['API_PROXY_TARGET'] ?? 'http://localhost:3000' };

// En developpement, Vite proxifie /api vers l API : meme origine, comme la reecriture Vercel en production (ADR-006, ADR-038).
export default defineConfig({
  plugins: [react(), tailwindcss(), pwa, versionMeta],
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Ports surchargeables (WEB_PORT, API_PROXY_TARGET) pour que la CI auto-hébergée ne heurte pas le poste de dev.
  server: { port: devPort, strictPort: true, proxy: apiProxy },
  // `vite preview` sert le build réel (service worker compris) avec le même proxy : E2E PWA hors ligne.
  preview: { port: devPort, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Les tests d'intégration rendent l'application complète (routes, gardes, shell) : plus lents sous couverture.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/test/**',
        'src/lib/pwa/register-sw.ts',
        'src/**/index.ts',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

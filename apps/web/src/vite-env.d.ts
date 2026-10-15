/// <reference types="vite/client" />

/** Variables publiques injectées au build par Vercel (INFRASTRUCTURE.md §6.5) ; aucune n'est secrète. */
interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

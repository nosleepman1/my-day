import 'i18next';

import type { resources } from './resources';

// Clés de traduction typées : une clé absente du fichier `fr` est une erreur de compilation.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['fr'];
  }
}

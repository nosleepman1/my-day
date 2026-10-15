import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { fr as zodFrench } from 'zod/locales';

import { resources } from './resources';

export const DEFAULT_LOCALE = 'fr';

/**
 * Instance i18next de l'application (FRONTEND.md §1) : `fr` est la seule langue livrée, ressources
 * embarquées (aucun chargement réseau), pas d'échappement HTML puisque React échappe déjà.
 */
export function createI18n(): i18n {
  // Messages de validation côté client en français (schémas Zod de @orbit/contracts).
  z.config(zodFrench());
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    resources,
    defaultNS: 'common',
    ns: Object.keys(resources.fr),
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

export { resources };

import auth from './fr/auth.json';
import capture from './fr/capture.json';
import common from './fr/common.json';
import errors from './fr/errors.json';
import home from './fr/home.json';
import nav from './fr/nav.json';
import onboarding from './fr/onboarding.json';
import organization from './fr/organization.json';
import settings from './fr/settings.json';

/** Ressources `fr` regroupées par espace de noms (un fichier JSON par domaine). */
export const resources = {
  fr: { common, errors, nav, auth, settings, onboarding, capture, home, organization },
} as const;

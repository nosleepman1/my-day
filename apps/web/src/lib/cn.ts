import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Tailles typographiques du design system (§3.4), à départager des couleurs `text-*`. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body', 'body-strong', 'small', 'caption'] }],
    },
  },
});

/** Combine des classes conditionnelles ; la dernière classe Tailwind d'un même groupe l'emporte. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

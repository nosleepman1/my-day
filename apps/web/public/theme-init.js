/* global window, document */
// Thème appliqué avant le premier rendu (DESIGN_SYSTEM.md §2), sans script inline (CSP `script-src 'self'`).
// `orbit:theme` : 'light' | 'dark' | 'system', simple confort d'affichage ; la préférence fait foi côté serveur.
try {
  const stored = window.localStorage.getItem('orbit:theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', stored === 'dark' || (stored !== 'light' && prefersDark));
} catch {
  // Stockage indisponible (navigation privée stricte) : le thème clair par défaut s'applique.
}

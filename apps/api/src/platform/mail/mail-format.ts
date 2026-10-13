const MAX_USER_AGENT_LENGTH = 200;

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Seul point d'échappement HTML des e-mails : toute valeur interpolée dans le HTML passe par ici. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** « 12 octobre 2026 à 09:30 (Africa/Dakar) ». Un fuseau invalide lève une `RangeError`. */
export function formatMoment(occurredAt: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(occurredAt);
  return `${formatted} (${timeZone})`;
}

export function describeIp(ipPrefix: string | null): string {
  return ipPrefix ?? 'adresse IP inconnue';
}

export function describeDevice(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim() === '') return 'appareil inconnu';
  return userAgent.length > MAX_USER_AGENT_LENGTH
    ? `${userAgent.slice(0, MAX_USER_AGENT_LENGTH)}…`
    : userAgent;
}

/** Refuse tout lien qui ne serait pas http(s) (`javascript:`, `data:`…) avant de l'insérer dans un e-mail. */
export function assertHttpUrl(url: string): string {
  const { protocol } = new URL(url);
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`Mail links must use http or https, got ${protocol}`);
  }
  return url;
}

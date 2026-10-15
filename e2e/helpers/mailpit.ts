import { expect } from '@playwright/test';

/** Interface web de Mailpit (`infra`) : 8025 en local, port dédié en CI auto-hébergée. */
const MAILPIT_URL = `http://localhost:${process.env['ORBIT_MAILPIT_UI_PORT'] ?? '8025'}`;

type MailpitSearch = Readonly<{ messages: readonly Readonly<{ ID: string }>[] }>;
type MailpitMessage = Readonly<{ Text: string }>;

async function latestMessageTo(address: string): Promise<MailpitMessage | null> {
  const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  const { messages } = (await search.json()) as MailpitSearch;
  const latest = messages[0];
  if (latest === undefined) return null;
  const message = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
  return (await message.json()) as MailpitMessage;
}

/**
 * Chemin relatif du lien à jeton reçu par `address` (`/verify-email#token=…`), en attendant l'e-mail :
 * l'envoi est détaché de la réponse HTTP (revue sécurité PHASE-01, M2).
 */
export async function tokenLinkFor(address: string, route: string): Promise<string> {
  let link = '';
  await expect
    .poll(
      async () => {
        const text = (await latestMessageTo(address))?.Text ?? '';
        link = new RegExp(`${route}#token=[A-Za-z0-9_%-]+`).exec(text)?.[0] ?? '';
        return link;
      },
      { timeout: 15_000 },
    )
    .not.toBe('');
  return link;
}

/** Adresse unique par test : les comptes E2E ne se marchent jamais dessus. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.orbit.test`;
}

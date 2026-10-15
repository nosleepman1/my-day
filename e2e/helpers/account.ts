import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

import { tokenLinkFor, uniqueEmail } from './mailpit';

const PASSWORD = 'une phrase de passe solide 2026';

/** argon2id aux paramètres réels et durée minimale uniforme (SECURITY.md §3.1). */
export const AUTH_RESPONSE = { timeout: 15_000 };

/** Aucune violation axe sérieuse ou critique (WCAG 2.2 AA). */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

/** Nouveau compte vérifié, connecté et passé par l'onboarding ; la page est sur l'accueil. */
export async function signUpAndOnboard(page: Page, prefix: string): Promise<void> {
  const email = uniqueEmail(prefix);
  await page.goto('/register');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText(/Si cette inscription est possible/)).toBeVisible(AUTH_RESPONSE);
  await page.goto(await tokenLinkFor(email, '/verify-email'));
  await expect(page.getByText('Adresse confirmée. Vous pouvez vous connecter.')).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans ORBIT' })).toBeVisible(AUTH_RESPONSE);
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
}

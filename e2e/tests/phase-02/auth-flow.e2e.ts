import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { tokenLinkFor, uniqueEmail } from '../../helpers/mailpit';

const PASSWORD = 'une phrase de passe solide 2026';

/**
 * Délai d'une réponse d'authentification : argon2id aux paramètres réels, sémaphore de hachage partagé
 * par les workers parallèles et durée minimale uniforme (SECURITY.md §3.1).
 */
const AUTH_RESPONSE = { timeout: 15_000 };

/** Aucune violation axe sérieuse ou critique (PHASE-02 §8, WCAG 2.2 AA). */
async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

async function register(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await expectAccessible(page);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText(/Si cette inscription est possible/)).toBeVisible(AUTH_RESPONSE);
  await page.goto(await tokenLinkFor(email, '/verify-email'));
  await expect(page.getByText('Adresse confirmée. Vous pouvez vous connecter.')).toBeVisible();
}

async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test.describe('PHASE-02 authentication journeys', () => {
  test('register, verify by e-mail, sign in, complete onboarding and reach home', async ({ page }) => {
    const email = uniqueEmail('signup');
    await register(page, email);

    await login(page, email);
    await expect(page.getByRole('heading', { name: 'Bienvenue dans ORBIT' })).toBeVisible(AUTH_RESPONSE);
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByLabel('Fuseau horaire')).toHaveValue('Africa/Dakar');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByRole('button', { name: 'Commencer' }).click();

    await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
    await expectAccessible(page);

    await page.goto('/settings/security');
    await expect(page.getByText('Cet appareil')).toBeVisible();
    await expectAccessible(page);

    await page.goto('/admin');
    await expect(page.getByText('Page introuvable')).toBeVisible();
  });

  test('reset a forgotten password through the e-mail link', async ({ page }) => {
    const email = uniqueEmail('reset');
    await register(page, email);

    await page.goto('/forgot-password');
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByText(/Si un compte existe pour cette adresse/)).toBeVisible(AUTH_RESPONSE);

    await page.goto(await tokenLinkFor(email, '/reset-password'));
    const newPassword = 'une toute nouvelle phrase 2026';
    await page.getByLabel('Nouveau mot de passe').fill(newPassword);
    await page.getByLabel('Confirmer le mot de passe').fill(newPassword);
    await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
    await expect(page.getByText('Mot de passe modifié. Connectez-vous avec le nouveau.')).toBeVisible(
      AUTH_RESPONSE,
    );

    await login(page, email, newPassword);
    await expect(page.getByRole('heading', { name: 'Bienvenue dans ORBIT' })).toBeVisible(AUTH_RESPONSE);
  });

  test('shows the generic error on wrong credentials and keeps the login page accessible', async ({
    page,
  }) => {
    await page.goto('/login');
    await expectAccessible(page);
    await login(page, uniqueEmail('unknown'), 'mauvais mot de passe');

    await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible(AUTH_RESPONSE);
  });
});

import { expect, test, type Page } from '@playwright/test';

import { expectAccessible, signUpAndOnboard } from '../../helpers/account';

/** Capture rapide : bouton + (mobile) ou bouton de la barre latérale (desktop), même libellé. */
async function quickCapture(page: Page, type: 'Idée' | 'Tâche' | 'Note', text: string): Promise<void> {
  await page.getByRole('button', { name: /^Capture( rapide)?$/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Texte à capturer' }).fill(text);
  await dialog.getByRole('radio', { name: type }).click();
  await dialog.getByRole('button', { name: 'Capturer' }).click();
  await expect(dialog).toBeHidden();
}

async function addTask(page: Page, title: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Nouvelle tâche…' }).fill(title);
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByRole('link', { name: title })).toBeVisible();
}

/** Date civile `JJ/MM/AAAA` de demain à Dakar (fuseau des comptes de test). */
function tomorrowInDakar(): string {
  const tomorrow = new Date(Date.now() + 86_400_000);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar' }).format(tomorrow);
}

test.describe('PHASE-04 organisation journeys', () => {
  test('capture an idea, convert it into a project, add a task and complete it', async ({ page }) => {
    await signUpAndOnboard(page, 'idea');
    await quickCapture(page, 'Idée', 'Vendre du bissap en bouteille');

    await page.goto('/ideas');
    await expectAccessible(page);
    await page.getByRole('link', { name: 'Vendre du bissap en bouteille' }).click();
    await page.getByRole('button', { name: 'Transformer en projet' }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(
      page.getByRole('link', { name: "Idée d'origine : Vendre du bissap en bouteille" }),
    ).toBeVisible();

    await addTask(page, 'Créer le logo');
    await page.getByRole('checkbox', { name: 'Terminer « Créer le logo »' }).click();
    await expect(page.getByText('Progression : 100 %')).toBeVisible();
    await expectAccessible(page);
  });

  test('complete a daily task and see the next occurrence', async ({ page }) => {
    await signUpAndOnboard(page, 'recurring');
    await page.goto('/tasks');
    await addTask(page, 'Arroser les plantes');
    await page.getByRole('link', { name: 'Arroser les plantes' }).click();
    await page.getByRole('combobox', { name: 'Récurrence' }).selectOption('DAILY');
    await page.getByRole('button', { name: 'Enregistrer' }).nth(1).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();

    await page.getByRole('button', { name: 'Terminer' }).click();
    await expect(page.getByText(`Prochaine occurrence prévue le ${tomorrowInDakar()}.`)).toBeVisible();
    await page.goto('/tasks?view=ALL');
    await expect(page.getByRole('link', { name: 'Arroser les plantes' })).toHaveCount(2);
  });

  test('capture offline and synchronise exactly once when the network returns', async ({ page, context }) => {
    await signUpAndOnboard(page, 'offline');
    await context.setOffline(true);
    await quickCapture(page, 'Idée', 'Idée notée dans le car rapide');
    await expect(page.getByText('1 capture en attente de synchronisation')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText('1 capture en attente de synchronisation')).toBeHidden({ timeout: 15_000 });
    await page.goto('/ideas');
    await expect(page.getByRole('link', { name: 'Idée notée dans le car rapide' })).toHaveCount(1);
  });

  test('move a task on the Kanban board and refuse a dependency cycle', async ({ page }) => {
    await signUpAndOnboard(page, 'kanban');
    await page.goto('/tasks?view=ALL');
    await addTask(page, 'Rédiger le devis');
    await addTask(page, 'Envoyer le devis');

    await page.goto('/tasks?view=ALL&display=kanban');
    await expectAccessible(page);
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: 'Rédiger le devis' }) });
    await card.dragTo(page.getByRole('region', { name: 'En cours' }));
    await expect(
      page.getByRole('region', { name: 'En cours' }).getByRole('link', { name: 'Rédiger le devis' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Envoyer le devis' }).click();
    await page
      .getByRole('combobox', { name: 'Choisir une tâche' })
      .selectOption({ label: 'Rédiger le devis' });
    await page.getByRole('button', { name: 'Ajouter' }).nth(1).click();
    await expect(page.getByRole('link', { name: 'Rédiger le devis' })).toBeVisible();

    await page.getByRole('link', { name: 'Rédiger le devis' }).click();
    await page
      .getByRole('combobox', { name: 'Choisir une tâche' })
      .selectOption({ label: 'Envoyer le devis' });
    await page.getByRole('button', { name: 'Ajouter' }).nth(1).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('write a note with safe Markdown and link it to a task', async ({ page }) => {
    await signUpAndOnboard(page, 'notes');
    await page.goto('/tasks?view=ALL');
    await addTask(page, 'Préparer la réunion');
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Nouvelle note' }).click();
    await page
      .getByRole('textbox', { name: 'Contenu' })
      .fill('# Compte rendu\n<img src=x onerror="alert(1)">\n[site](javascript:alert(1))');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();
    await page.getByRole('button', { name: 'Aperçu' }).click();
    await expect(page.getByRole('heading', { name: 'Compte rendu' })).toBeVisible();
    await expect(page.locator('main img')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'site' })).toHaveCount(0);

    await page
      .getByRole('combobox', { name: 'Élément', exact: true })
      .selectOption({ label: 'Préparer la réunion' });
    await page.getByRole('button', { name: 'Relier' }).click();
    await expect(page.getByRole('link', { name: 'Préparer la réunion' })).toBeVisible();
    await expectAccessible(page);
  });
});

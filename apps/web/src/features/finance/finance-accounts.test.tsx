import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockSession } from '@/test/api-fixtures';
import {
  accountFixture,
  balancesFixture,
  ID,
  mockFinanceEndpoints,
  transactionFixture,
} from '@/test/finance-fixtures';
import { renderApp } from '@/test/render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Finance - Overview page (/finance)', () => {
  it('renders balances by currency, accounts list and quick actions', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ name: 'Wave Principal', currentBalanceMinor: '150000', currency: 'XOF' })],
      balances: balancesFixture({ totalsByCurrency: { XOF: '150000' } }),
      transactions: [
        transactionFixture({ description: 'Achat supermarché', amountMinor: '15000', currency: 'XOF' }),
      ],
    });

    renderApp('/finance');

    expect(await screen.findByRole('heading', { name: /Vue d['’]ensemble/i })).toBeInTheDocument();
    expect(await screen.findByText('Wave Principal')).toBeInTheDocument();
    expect(screen.getByText('Soldes par devise')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dépense' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrée' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Transfert' })).toBeInTheDocument();
    expect(await screen.findByText('Achat supermarché')).toBeInTheDocument();
  });
});

describe('Finance - Accounts page (/finance/accounts)', () => {
  it('lists accounts and filters archived accounts', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [
        accountFixture({ id: ID(1), name: 'Compte Courant', archivedAt: null }),
        accountFixture({ id: ID(2), name: 'Ancien Compte', archivedAt: '2026-05-01T00:00:00Z' }),
      ],
    });

    const user = userEvent.setup();
    renderApp('/finance/accounts');

    expect(await screen.findByText('Compte Courant')).toBeInTheDocument();
    expect(screen.queryByText('Ancien Compte')).not.toBeInTheDocument();

    const switchBtn = screen.getByLabelText('Afficher les comptes archivés');
    await user.click(switchBtn);

    expect(await screen.findByText('Ancien Compte')).toBeInTheDocument();
  });

  it('creates a new account via the form dialog', async () => {
    mockSession();
    const { getAccounts } = mockFinanceEndpoints({ accounts: [] });
    const user = userEvent.setup();

    renderApp('/finance/accounts');

    const newBtn = await screen.findByRole('button', { name: 'Nouveau compte' });
    await user.click(newBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Créer un compte')).toBeInTheDocument();

    const nameInput = within(dialog).getByLabelText('Nom du compte');
    await user.type(nameInput, 'Orange Money');

    const submitBtn = within(dialog).getByRole('button', { name: 'Enregistrer' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(getAccounts().some((a) => a.name === 'Orange Money')).toBe(true);
    });
  });
});

describe('Finance - Account detail page (/finance/accounts/:id)', () => {
  it('renders account details and its entries, and allows archiving', async () => {
    mockSession();
    const testAccount = accountFixture({
      id: ID(1),
      name: 'Compte CBAO',
      currentBalanceMinor: '250000',
      currency: 'XOF',
      allowOverdraft: true,
      overdraftLimitMinor: '50000',
      archivedAt: null,
    });
    mockFinanceEndpoints({
      accounts: [testAccount],
      transactions: [
        transactionFixture({
          description: 'Paiement salaire',
          type: 'INCOME',
          amountMinor: '250000',
          currency: 'XOF',
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp(`/finance/accounts/${ID(1)}`);

    expect(await screen.findByRole('heading', { name: 'Compte CBAO' })).toBeInTheDocument();
    expect(screen.getByText('Découvert autorisé')).toBeInTheDocument();
    expect(screen.getByText('Paiement salaire')).toBeInTheDocument();

    const archiveBtn = screen.getByRole('button', { name: 'Archiver le compte' });
    await user.click(archiveBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);

    expect(await screen.findByRole('button', { name: 'Réactiver le compte' })).toBeInTheDocument();
  });
});

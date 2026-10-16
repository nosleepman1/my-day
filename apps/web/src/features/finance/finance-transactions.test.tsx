import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockSession } from '@/test/api-fixtures';
import { accountFixture, ID, mockFinanceEndpoints, NOW, transactionFixture } from '@/test/finance-fixtures';
import { renderApp } from '@/test/render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Finance - Transactions list (/finance/transactions)', () => {
  it('renders transactions list with various statuses and applies filters', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [
        accountFixture({ id: ID(1), name: 'Compte Courant', currency: 'XOF' }),
        accountFixture({ id: ID(2), name: 'Épargne', currency: 'XOF' }),
      ],
      transactions: [
        transactionFixture({
          id: ID(10),
          description: 'Abonnement Internet',
          amountMinor: '25000',
          currency: 'XOF',
          status: 'VALIDATED',
          type: 'EXPENSE',
        }),
        transactionFixture({
          id: ID(11),
          description: 'Vente prestation',
          amountMinor: '100000',
          currency: 'XOF',
          status: 'PENDING',
          type: 'INCOME',
        }),
        transactionFixture({
          id: ID(12),
          description: null,
          amountMinor: '50000',
          currency: 'XOF',
          status: 'CANCELLED',
          type: 'TRANSFER',
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp('/finance/transactions');

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(await screen.findByText('Abonnement Internet')).toBeInTheDocument();
    expect(screen.getByText('Vente prestation')).toBeInTheDocument();
    expect(screen.getAllByText('Validée').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('En attente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Annulée').length).toBeGreaterThanOrEqual(1);

    const typeSelect = screen.getByLabelText('Type');
    await user.selectOptions(typeSelect, 'INCOME');

    const statusSelect = screen.getByLabelText('Statut');
    await user.selectOptions(statusSelect, 'PENDING');

    const accountSelect = screen.getByLabelText('Compte');
    await user.selectOptions(accountSelect, ID(1));
  });

  it('renders empty state when there are no transactions', async () => {
    mockSession();
    mockFinanceEndpoints({
      transactions: [],
    });

    renderApp('/finance/transactions');

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune transaction')).toBeInTheDocument();
  });
});

describe('Finance - Transaction detail and cancellation (/finance/transactions/:id)', () => {
  it('renders transaction details, entries, and cancels the transaction with a reason', async () => {
    mockSession();
    const endpoint = mockFinanceEndpoints({
      transactions: [
        transactionFixture({
          id: ID(10),
          description: 'Facture électricité',
          amountMinor: '15000',
          currency: 'XOF',
          status: 'VALIDATED',
          ledgerEntries: [
            {
              id: ID(100),
              transactionId: ID(10),
              accountId: ID(1),
              direction: 'DEBIT',
              amountMinor: '15000',
              currency: 'XOF',
              createdAt: NOW,
            },
          ],
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp(`/finance/transactions/${ID(10)}`);

    expect(await screen.findByText('Facture électricité')).toBeInTheDocument();
    expect(screen.getByText('Écritures comptables associées')).toBeInTheDocument();
    expect(screen.getByText('Débit')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Annuler' });
    await user.click(cancelBtn);

    const reasonInput = await screen.findByLabelText("Motif de l'annulation");
    await user.type(reasonInput, 'Erreur de saisie double');

    const confirmBtn = screen.getByRole('button', { name: "Confirmer l'annulation" });
    await user.click(confirmBtn);

    await waitFor(() => {
      const tx = endpoint.getTransactions().find((t) => t.id === ID(10));
      expect(tx?.status).toBe('CANCELLED');
    });
  });
});

describe('Finance - Create transaction (/finance/transactions/new)', () => {
  it('submits a new transaction with account, amount, and description', async () => {
    mockSession();
    const endpoint = mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Wave Principal', currency: 'XOF' })],
      transactions: [],
    });

    const user = userEvent.setup();
    renderApp('/finance/transactions/new?type=EXPENSE');

    expect(await screen.findByRole('heading', { name: 'Nouvelle dépense' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Wave Principal/i })).toBeInTheDocument();

    const accountSelect = screen.getByLabelText('Compte');
    await user.selectOptions(accountSelect, ID(1));

    const amountInput = screen.getByLabelText('Montant');
    await user.clear(amountInput);
    await user.type(amountInput, '5000');

    const descInput = screen.getByLabelText('Description');
    await user.type(descInput, 'Courses marché');

    const submitBtn = screen.getByRole('button', { name: 'Enregistrer' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(endpoint.getTransactions().length).toBe(1);
      expect(endpoint.getTransactions()[0]?.description).toBe('Courses marché');
    });
  });

  it('disables submit and displays warning when offline', async () => {
    mockSession();
    mockFinanceEndpoints();

    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    try {
      renderApp('/finance/transactions/new?type=EXPENSE');

      expect(await screen.findByText('Hors ligne : saisie financière indisponible.')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: 'Enregistrer' });
      expect(submitBtn).toBeDisabled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });
});

describe('Finance - Create transfer (/finance/transfers/new)', () => {
  it('prevents selecting the same account and submits transfer between two distinct accounts', async () => {
    mockSession();
    const endpoint = mockFinanceEndpoints({
      accounts: [
        accountFixture({ id: ID(1), name: 'Wave Principal', currency: 'XOF' }),
        accountFixture({ id: ID(2), name: 'Compte Bancaire', currency: 'XOF' }),
      ],
      transactions: [],
    });

    const user = userEvent.setup();
    renderApp('/finance/transfers/new');

    expect(await screen.findByRole('heading', { name: 'Nouveau transfert' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: /Compte Bancaire/i }).length).toBe(2);
    });

    const fromSelect = screen.getByLabelText('Compte source');
    const toSelect = screen.getByLabelText('Compte destination');

    await user.selectOptions(fromSelect, ID(1));
    await user.selectOptions(toSelect, ID(1));

    expect(
      await screen.findByText('Le compte source et le compte destination doivent être différents.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Effectuer le transfert' })).toBeDisabled();

    await user.selectOptions(toSelect, ID(2));
    expect(
      screen.queryByText('Le compte source et le compte destination doivent être différents.'),
    ).not.toBeInTheDocument();

    const amountInput = screen.getByLabelText('Montant transféré');
    await user.clear(amountInput);
    await user.type(amountInput, '20000');

    const submitBtn = screen.getByRole('button', { name: 'Effectuer le transfert' });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(endpoint.getTransactions().length).toBe(1);
      expect(endpoint.getTransactions()[0]?.type).toBe('TRANSFER');
    });
  });
});

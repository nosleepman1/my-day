import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockSession } from '@/test/api-fixtures';
import { accountFixture, ID, mockFinanceEndpoints } from '@/test/finance-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Finance - Account adjustments & reconciliation (/finance/accounts/:id)', () => {
  it('opens adjust balance dialog and submits adjustment', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Wave Principal', currency: 'XOF' })],
    });

    const user = userEvent.setup();
    renderApp(`/finance/accounts/${ID(1)}`);

    expect(await screen.findByRole('heading', { name: 'Wave Principal' })).toBeInTheDocument();

    const adjustBtn = screen.getByRole('button', { name: 'Ajuster le solde' });
    await user.click(adjustBtn);

    expect(await screen.findByRole('heading', { name: 'Ajuster le solde' })).toBeInTheDocument();

    const amountInput = screen.getByLabelText("Montant de l'ajustement");
    await user.clear(amountInput);
    await user.type(amountInput, '5000');

    const reasonInput = screen.getByLabelText("Motif de l'ajustement");
    await user.type(reasonInput, 'Correction écart de caisse');

    const submitBtn = screen.getByRole('button', { name: 'Ajuster' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ajuster le solde' })).not.toBeInTheDocument();
    });
  });

  it('opens reconciliation dialog, renders preview, and confirms', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Courant', currency: 'XOF' })],
    });

    const user = userEvent.setup();
    renderApp(`/finance/accounts/${ID(1)}`);

    expect(await screen.findByRole('heading', { name: 'Compte Courant' })).toBeInTheDocument();

    const reconcileBtn = screen.getByRole('button', { name: 'Rapprocher' });
    await user.click(reconcileBtn);

    expect(await screen.findByRole('heading', { name: 'Rapprochement bancaire' })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer le rapprochement' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Rapprochement bancaire' })).not.toBeInTheDocument();
    });
  });
});

describe('Finance - Categories management (/finance/categories)', () => {
  it('lists categories and creates a new category', async () => {
    mockSession();
    mockFinanceEndpoints();

    const user = userEvent.setup();
    renderApp('/finance/categories');

    expect(await screen.findByRole('heading', { name: 'Catégories financières' })).toBeInTheDocument();
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();

    const newBtn = screen.getByRole('button', { name: 'Nouvelle catégorie' });
    await user.click(newBtn);

    expect(await screen.findByRole('heading', { name: 'Nouvelle catégorie' })).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Nom de la catégorie');
    await user.type(nameInput, 'Santé & Pharmacie');

    const saveBtn = screen.getByRole('button', { name: 'Enregistrer' });
    await user.click(saveBtn);

    expect(await screen.findByText('Santé & Pharmacie')).toBeInTheDocument();
  });
});

describe('Finance - Counterparties management (/finance/counterparties)', () => {
  it('lists counterparties and creates a new counterparty', async () => {
    mockSession();
    mockFinanceEndpoints();

    const user = userEvent.setup();
    renderApp('/finance/counterparties');

    expect(await screen.findByRole('heading', { name: 'Contreparties' })).toBeInTheDocument();
    expect(await screen.findByText('Auchan Supermarché')).toBeInTheDocument();

    const newBtn = screen.getByRole('button', { name: 'Nouvelle contrepartie' });
    await user.click(newBtn);

    expect(await screen.findByRole('heading', { name: 'Nouvelle contrepartie' })).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Nom');
    await user.type(nameInput, 'Boutique Quartier');

    const saveBtn = screen.getByRole('button', { name: 'Enregistrer' });
    await user.click(saveBtn);

    expect(await screen.findByText('Boutique Quartier')).toBeInTheDocument();
  });
});

describe('Finance - Reports (/finance/reports)', () => {
  it('renders summary, breakdown, balances, and cashflow reports', async () => {
    mockSession();
    mockFinanceEndpoints();

    const user = userEvent.setup();
    renderApp('/finance/reports');

    expect(await screen.findByRole('heading', { name: 'Rapports financiers' })).toBeInTheDocument();
    expect(await screen.findByText('XOF')).toBeInTheDocument();

    const breakdownTab = screen.getByRole('button', { name: 'Par catégorie' });
    await user.click(breakdownTab);
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();

    const incomeBtn = screen.getByRole('button', { name: 'Catégories de revenus' });
    await user.click(incomeBtn);

    const expenseBtn = screen.getByRole('button', { name: 'Catégories de dépenses' });
    await user.click(expenseBtn);

    const balancesTab = screen.getByRole('button', { name: 'Soldes' });
    await user.click(balancesTab);
    expect(await screen.findByText('Wave Principal')).toBeInTheDocument();

    const cashflowTab = screen.getByRole('button', { name: 'Flux de trésorerie' });
    await user.click(cashflowTab);
    expect(await screen.findByText('2026-10')).toBeInTheDocument();
  });

  it('renders empty report states when reports are empty', async () => {
    mockSession();
    mockFinanceEndpoints();
    server.use(
      http.get('/api/v1/finance/reports/summary', () =>
        HttpResponse.json({
          data: {
            period: { from: '2026-10-01', to: '2026-10-31' },
            summaries: [],
          },
        }),
      ),
      http.get('/api/v1/finance/reports/by-category', () =>
        HttpResponse.json({
          data: {
            period: { fromDate: '2026-10-01', toDate: '2026-10-31' },
            currency: 'XOF',
            kind: 'EXPENSE',
            totalMinor: '0',
            categories: [],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    renderApp('/finance/reports');

    expect(await screen.findByRole('heading', { name: 'Rapports financiers' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune donnée financière pour cette période.')).toBeInTheDocument();

    const breakdownTab = screen.getByRole('button', { name: 'Par catégorie' });
    await user.click(breakdownTab);
    expect(await screen.findByText('Aucune donnée financière pour cette période.')).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockSession } from '@/test/api-fixtures';
import { accountFixture, ID, mockFinanceEndpoints } from '@/test/finance-fixtures';
import {
  forecastFixture,
  mockRecurringAndForecastEndpoints,
  occurrenceFixture,
  recurringFixture,
} from '@/test/finance-recurring-fixtures';
import { renderApp } from '@/test/render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Finance - Récurrences (/finance/recurring)', () => {
  it('lists recurring transactions and handles empty state', async () => {
    mockSession();
    mockRecurringAndForecastEndpoints({
      recurring: [
        recurringFixture({
          id: ID(101),
          name: 'Abonnement Internet Fibre',
          amountMinor: '25000',
          currency: 'XOF',
          status: 'ACTIVE',
          type: 'EXPENSE',
          nextOccurrenceAt: '2026-11-01T00:00:00.000Z',
        }),
        recurringFixture({
          id: ID(102),
          name: 'Salaire consultant',
          amountMinor: '500000',
          currency: 'XOF',
          status: 'PAUSED',
          type: 'INCOME',
          nextOccurrenceAt: null,
        }),
        recurringFixture({
          id: ID(103),
          name: 'Épargne programmée',
          amountMinor: '100000',
          currency: 'XOF',
          status: 'ENDED',
          type: 'TRANSFER',
          nextOccurrenceAt: null,
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp('/finance/recurring');

    expect(await screen.findByRole('heading', { name: 'Transactions récurrentes' })).toBeInTheDocument();
    expect(await screen.findByText('Abonnement Internet Fibre')).toBeInTheDocument();
    expect(screen.getByText('Salaire consultant')).toBeInTheDocument();
    expect(screen.getByText('Épargne programmée')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('En pause')).toBeInTheDocument();
    expect(screen.getByText('Terminée')).toBeInTheDocument();

    const pauseBtn = screen.getByRole('button', { name: 'Mettre en pause' });
    await user.click(pauseBtn);

    const [resumeBtn] = screen.getAllByRole('button', { name: 'Reprendre' });
    await user.click(resumeBtn!);
  });

  it('creates a new recurring transaction via form', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Courant', currency: 'XOF' })],
    });
    mockRecurringAndForecastEndpoints({
      recurring: [],
    });

    const user = userEvent.setup();
    renderApp('/finance/recurring/new');

    expect(await screen.findByRole('heading', { name: 'Nouvelle récurrence' })).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Nom / Libellé');
    await user.type(nameInput, 'Abonnement Hébergement VPS');

    const accountSelect = screen.getByLabelText('Compte source');
    await user.selectOptions(accountSelect, ID(1));

    const amountInput = screen.getByLabelText('Montant');
    await user.clear(amountInput);
    await user.type(amountInput, '15000');

    const freqSelect = screen.getByLabelText('Périodicité');
    await user.selectOptions(freqSelect, 'MONTHLY');

    const submitBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Transactions récurrentes' })).toBeInTheDocument();
    });
  });

  it('displays recurring detail and pauses/resumes recurring transaction', async () => {
    mockSession();
    mockRecurringAndForecastEndpoints({
      recurring: [
        recurringFixture({
          id: ID(101),
          name: 'Abonnement Cloud Server',
          status: 'ACTIVE',
        }),
      ],
      occurrences: [
        occurrenceFixture({
          id: ID(201),
          recurringTransactionId: ID(101),
          status: 'EXPECTED',
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp(`/finance/recurring/${ID(101)}`);

    expect(await screen.findByRole('heading', { name: 'Abonnement Cloud Server' })).toBeInTheDocument();
    const pauseBtn = await screen.findByRole('button', { name: 'Mettre en pause' });
    await user.click(pauseBtn);

    expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeInTheDocument();

    const resumeBtn = screen.getByRole('button', { name: 'Reprendre' });
    await user.click(resumeBtn);

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument();
  });
});

describe('Finance - À venir (/finance/upcoming)', () => {
  it('lists expected occurrences with overdue badges and allows confirming an occurrence', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Courant', currency: 'XOF' })],
    });
    mockRecurringAndForecastEndpoints({
      occurrences: [
        occurrenceFixture({
          id: ID(301),
          dueOn: '2026-10-10',
          isOverdue: true,
          status: 'EXPECTED',
          expectedAmountMinor: '10000',
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp('/finance/upcoming');

    expect(await screen.findByRole('heading', { name: 'Échéances à venir' })).toBeInTheDocument();
    expect(await screen.findByText('Échue')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);

    expect(await screen.findByRole('heading', { name: "Confirmer l'échéance" })).toBeInTheDocument();
    const submitDialogBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(submitDialogBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: "Confirmer l'échéance" })).not.toBeInTheDocument();
    });
  });

  it('allows skipping an occurrence with a skip dialog', async () => {
    mockSession();
    mockRecurringAndForecastEndpoints({
      occurrences: [
        occurrenceFixture({
          id: ID(302),
          dueOn: '2026-10-25',
          isOverdue: false,
          status: 'EXPECTED',
          expectedAmountMinor: '5000',
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp('/finance/upcoming');

    expect(await screen.findByRole('heading', { name: 'Échéances à venir' })).toBeInTheDocument();

    const skipBtn = await screen.findByRole('button', { name: 'Ignorer' });
    await user.click(skipBtn);

    expect(await screen.findByRole('heading', { name: 'Ignorer cette échéance' })).toBeInTheDocument();
    const confirmSkipBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmSkipBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ignorer cette échéance' })).not.toBeInTheDocument();
    });
  });
});

describe('Finance - Prévisions (/finance/forecast)', () => {
  it('renders cashflow forecast summary and chart points', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Principal', currency: 'XOF' })],
    });
    mockRecurringAndForecastEndpoints({
      forecast: forecastFixture({
        accounts: [
          {
            accountId: ID(1),
            accountName: 'Compte Principal',
            currency: 'XOF',
            currentBalanceMinor: '100000',
            projectedEndBalanceMinor: '80000',
            lowestProjectedBalanceMinor: '60000',
            hasProjectedNegative: false,
            points: [
              {
                date: '2026-10-15',
                realisedBalanceMinor: '100000',
                projectedBalanceMinor: '100000',
                expectedInflowsMinor: '0',
                expectedOutflowsMinor: '0',
              },
              {
                date: '2026-11-01',
                realisedBalanceMinor: null,
                projectedBalanceMinor: '80000',
                expectedInflowsMinor: '0',
                expectedOutflowsMinor: '20000',
              },
            ],
          },
        ],
      }),
    });

    renderApp('/finance/forecast');

    expect(await screen.findByRole('heading', { name: 'Prévisions de trésorerie' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Compte Principal (XOF)' })).toBeInTheDocument();
    expect(screen.getByText('Solde projeté fin de période')).toBeInTheDocument();
    expect(screen.getByText('Point bas anticipé')).toBeInTheDocument();
  });

  it('displays warning alert when forecast projects a negative balance', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Risque Découvert', currency: 'XOF' })],
    });
    mockRecurringAndForecastEndpoints({
      forecast: forecastFixture({
        accounts: [
          {
            accountId: ID(1),
            accountName: 'Compte Risque Découvert',
            currency: 'XOF',
            currentBalanceMinor: '10000',
            projectedEndBalanceMinor: '-40000',
            lowestProjectedBalanceMinor: '-50000',
            hasProjectedNegative: true,
            points: [
              {
                date: '2026-11-15',
                realisedBalanceMinor: null,
                projectedBalanceMinor: '-40000',
                expectedInflowsMinor: '0',
                expectedOutflowsMinor: '50000',
              },
            ],
          },
        ],
      }),
    });

    renderApp('/finance/forecast');

    expect(await screen.findByRole('heading', { name: 'Prévisions de trésorerie' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('updates forecast filters when changing horizon, account, and debts toggle', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [
        accountFixture({ id: ID(1), name: 'Compte 1', currency: 'XOF' }),
        accountFixture({ id: ID(2), name: 'Compte 2', currency: 'EUR' }),
      ],
    });
    mockRecurringAndForecastEndpoints({
      forecast: forecastFixture({
        accounts: [],
      }),
    });

    const user = userEvent.setup();
    renderApp('/finance/forecast');

    expect(await screen.findByRole('heading', { name: 'Prévisions de trésorerie' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune projection disponible pour cet horizon.')).toBeInTheDocument();

    const horizonSelect = screen.getByLabelText('Horizon temporel');
    await user.selectOptions(horizonSelect, '60');
    await user.selectOptions(horizonSelect, '90');

    const accountSelect = screen.getByLabelText('Compte');
    await user.selectOptions(accountSelect, ID(1));

    const includeDebtsCheckbox = screen.getByLabelText('Inclure les échéances de dettes et créances');
    await user.click(includeDebtsCheckbox);
  });

  it('allows skipping an occurrence from recurring detail page', async () => {
    mockSession();
    mockRecurringAndForecastEndpoints({
      recurring: [
        recurringFixture({
          id: ID(102),
          name: 'Serveur de sauvegarde',
          status: 'ACTIVE',
        }),
      ],
      occurrences: [
        occurrenceFixture({
          id: ID(202),
          recurringTransactionId: ID(102),
          status: 'EXPECTED',
        }),
      ],
    });

    const user = userEvent.setup();
    renderApp(`/finance/recurring/${ID(102)}`);

    expect(await screen.findByRole('heading', { name: 'Serveur de sauvegarde' })).toBeInTheDocument();

    const skipBtn = await screen.findByRole('button', { name: 'Ignorer' });
    await user.click(skipBtn);

    expect(await screen.findByRole('heading', { name: 'Ignorer cette échéance' })).toBeInTheDocument();

    const confirmSkipBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmSkipBtn);
  });

  it('renders empty state on /finance/recurring when there are no items', async () => {
    mockSession();
    mockRecurringAndForecastEndpoints({
      recurring: [],
    });

    renderApp('/finance/recurring');

    expect(await screen.findByRole('heading', { name: 'Transactions récurrentes' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune récurrence enregistrée')).toBeInTheDocument();
  });

  it('renders empty state on /finance/upcoming when there are no occurrences', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Courant', currency: 'XOF' })],
    });
    mockRecurringAndForecastEndpoints({
      occurrences: [],
    });

    renderApp('/finance/upcoming');

    expect(await screen.findByRole('heading', { name: 'Échéances à venir' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune échéance à venir')).toBeInTheDocument();
  });
});

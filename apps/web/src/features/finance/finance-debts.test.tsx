import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockSession } from '@/test/api-fixtures';
import {
  accountFixture,
  debtFixture,
  debtSummaryFixture,
  ID,
  mockFinanceEndpoints,
  repaymentFixture,
} from '@/test/finance-fixtures';
import { renderApp } from '@/test/render';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Finance - Dettes et créances (/finance/debts)', () => {
  it('lists debts, renders summary cards, and filters by type tab', async () => {
    mockSession();
    mockFinanceEndpoints({
      debts: [
        debtFixture({
          id: ID(50),
          title: 'Prêt équipement atelier',
          type: 'PAYABLE',
          principalMinor: '250000',
          remainingMinor: '200000',
          currency: 'XOF',
        }),
        debtFixture({
          id: ID(51),
          title: 'Avance sur facture client',
          type: 'RECEIVABLE',
          principalMinor: '100000',
          remainingMinor: '100000',
          currency: 'XOF',
          isOverdue: true,
        }),
        debtFixture({
          id: ID(52),
          title: 'Dette réglée sans contrepartie',
          type: 'PAYABLE',
          principalMinor: '50000',
          totalRepaidMinor: '50000',
          remainingMinor: '0',
          settlementStatus: 'SETTLED',
          status: 'OPEN',
          dueDate: null,
          counterparty: undefined,
        }),
        debtFixture({
          id: ID(54),
          title: 'Créance radiée',
          type: 'RECEIVABLE',
          principalMinor: '100000',
          totalRepaidMinor: '0',
          remainingMinor: '100000',
          status: 'WRITTEN_OFF',
          dueDate: null,
        }),
      ],
      debtSummary: debtSummaryFixture(),
    });

    const user = userEvent.setup();
    renderApp('/finance/debts');

    expect(await screen.findByRole('heading', { name: 'Dettes & Créances' })).toBeInTheDocument();
    expect(await screen.findByText('Devise : XOF')).toBeInTheDocument();
    expect(await screen.findByText('Prêt équipement atelier')).toBeInTheDocument();
    expect(screen.getByText('Avance sur facture client')).toBeInTheDocument();

    // Vérifie le badge "En retard" sur la créance
    expect(screen.getByText('En retard')).toBeInTheDocument();

    // Clic sur l'onglet "Je dois (dettes)"
    const payableTab = screen.getByRole('tab', { name: 'Je dois (dettes)' });
    await user.click(payableTab);

    expect(screen.getByText('Prêt équipement atelier')).toBeInTheDocument();
    expect(screen.queryByText('Avance sur facture client')).not.toBeInTheDocument();

    // Clic sur l'onglet "On me doit (créances)"
    const receivableTab = screen.getByRole('tab', { name: 'On me doit (créances)' });
    await user.click(receivableTab);

    expect(screen.queryByText('Prêt équipement atelier')).not.toBeInTheDocument();
    expect(screen.getByText('Avance sur facture client')).toBeInTheDocument();
  });

  it('creates a new debt via /finance/debts/new', async () => {
    mockSession();
    mockFinanceEndpoints({
      accounts: [accountFixture({ id: ID(1), name: 'Compte Courant', currency: 'XOF' })],
    });

    const user = userEvent.setup();
    renderApp('/finance/debts/new');

    expect(await screen.findByRole('heading', { name: 'Nouvelle dette ou créance' })).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Intitulé');
    await user.type(titleInput, 'Facture électricité en attente');

    const counterpartySelect = screen.getByLabelText('Contrepartie');
    await user.selectOptions(counterpartySelect, ID(30));

    const amountInput = screen.getByLabelText('Montant initial');
    await user.clear(amountInput);
    await user.type(amountInput, '75000');

    const dueDateInput = screen.getByLabelText("Date d'échéance (optionnelle)");
    await user.type(dueDateInput, '2026-12-31');

    const descInput = screen.getByLabelText('Description');
    await user.type(descInput, 'Facture trimestrielle');

    const initialCheck = screen.getByLabelText('Enregistrer le mouvement de trésorerie initial maintenant');
    await user.click(initialCheck);

    const accountSelect = await screen.findByLabelText('Compte bancaire / caisse');
    await user.selectOptions(accountSelect, ID(1));

    const submitBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(submitBtn);

    // Après soumission, on est redirigé vers la page de détail de la dette
    expect(
      await screen.findByRole('heading', { name: 'Facture électricité en attente' }),
    ).toBeInTheDocument();
  });

  it('displays debt details, repayments history, and records a new repayment', async () => {
    mockSession();
    mockFinanceEndpoints({
      debts: [
        debtFixture({
          id: ID(50),
          title: 'Emprunt matériel informatique',
          type: 'PAYABLE',
          principalMinor: '250000',
          totalRepaidMinor: '50000',
          remainingMinor: '200000',
          currency: 'XOF',
          settlementStatus: 'PARTIALLY_SETTLED',
        }),
      ],
      repayments: [
        repaymentFixture({
          id: ID(70),
          debtId: ID(50),
          amountMinor: '50000',
          notes: 'Premier versement',
        }),
      ],
      accounts: [accountFixture({ id: ID(1), name: 'Wave Principal', currency: 'XOF' })],
    });

    const user = userEvent.setup();
    renderApp(`/finance/debts/${ID(50)}`);

    expect(await screen.findByRole('heading', { name: 'Emprunt matériel informatique' })).toBeInTheDocument();
    expect(screen.getByText('Premier versement')).toBeInTheDocument();

    // Ouvre le dialogue de remboursement
    const repayBtn = screen.getByRole('button', { name: 'Rembourser' });
    await user.click(repayBtn);

    expect(await screen.findByRole('heading', { name: 'Enregistrer un remboursement' })).toBeInTheDocument();

    const accountSelect = screen.getByLabelText('Compte bancaire / caisse');
    await user.selectOptions(accountSelect, ID(1));

    const amountInput = screen.getByLabelText('Montant remboursé');
    await user.clear(amountInput);
    await user.type(amountInput, '100000');

    const notesInput = screen.getByLabelText('Notes');
    await user.type(notesInput, 'Deuxième acompte');

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Enregistrer un remboursement' })).not.toBeInTheDocument();
    });

    expect(await screen.findByText('Deuxième acompte')).toBeInTheDocument();
  });

  it('cancels an open debt without repayments', async () => {
    mockSession();
    mockFinanceEndpoints({
      debts: [
        debtFixture({
          id: ID(52),
          title: 'Dette annulable',
          type: 'PAYABLE',
          principalMinor: '100000',
          totalRepaidMinor: '0',
          remainingMinor: '100000',
          settlementStatus: 'UNPAID',
          status: 'OPEN',
        }),
      ],
      repayments: [],
    });

    const user = userEvent.setup();
    renderApp(`/finance/debts/${ID(52)}`);

    expect(await screen.findByRole('heading', { name: 'Dette annulable' })).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Annuler la dette' });
    await user.click(cancelBtn);

    expect(await screen.findByRole('heading', { name: 'Annuler la dette / créance' })).toBeInTheDocument();

    const reasonInput = screen.getByLabelText("Motif d'annulation");
    await user.type(reasonInput, 'Annulation par accord mutuel des parties');

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Annuler la dette / créance' })).not.toBeInTheDocument();
    });

    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    expect(screen.getByText('Annulation par accord mutuel des parties')).toBeInTheDocument();
  });

  it('writes off an uncollectible receivable', async () => {
    mockSession();
    mockFinanceEndpoints({
      debts: [
        debtFixture({
          id: ID(53),
          title: 'Créance client défaillant',
          type: 'RECEIVABLE',
          principalMinor: '150000',
          totalRepaidMinor: '0',
          remainingMinor: '150000',
          settlementStatus: 'UNPAID',
          status: 'OPEN',
        }),
      ],
      repayments: [],
    });

    const user = userEvent.setup();
    renderApp(`/finance/debts/${ID(53)}`);

    expect(await screen.findByRole('heading', { name: 'Créance client défaillant' })).toBeInTheDocument();

    const writeOffBtn = screen.getByRole('button', { name: 'Passer en perte' });
    await user.click(writeOffBtn);

    expect(await screen.findByRole('heading', { name: 'Passer la créance en perte' })).toBeInTheDocument();

    const reasonInput = screen.getByLabelText('Motif de passage en perte');
    await user.type(reasonInput, 'Liquidation judiciaire du client');

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Passer la créance en perte' })).not.toBeInTheDocument();
    });

    expect(await screen.findByText('Passée en perte')).toBeInTheDocument();
    expect(screen.getByText('Liquidation judiciaire du client')).toBeInTheDocument();
  });

  it('renders empty state when there are no debts and applies filters', async () => {
    mockSession();
    mockFinanceEndpoints({
      debts: [],
      debtSummary: debtSummaryFixture(),
    });

    const user = userEvent.setup();
    renderApp('/finance/debts');

    expect(await screen.findByRole('heading', { name: 'Dettes & Créances' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune dette ni créance')).toBeInTheDocument();

    const cpFilter = screen.getByLabelText('Contrepartie');
    await user.selectOptions(cpFilter, ID(30));

    const statusFilter = screen.getByLabelText('Statut');
    await user.selectOptions(statusFilter, 'CANCELLED');

    const overdueFilter = screen.getByLabelText('En retard uniquement');
    await user.click(overdueFilter);
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '@/lib/http/client';

import { ArchivedBanner, OfflineBanner, StaleBanner } from './banners';
import { ConflictDialog } from './conflict-dialog';
import { MoneyAmount } from './money-amount';
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LOADING_DELAY_MS,
  LoadingState,
  ModuleDisabledState,
  NotFoundState,
} from './states';

const NBSP = ' ';

describe('MoneyAmount', () => {
  it.each([
    ['0', 'neutral', `0${NBSP}FCFA`],
    ['5000', 'out', `−5${NBSP}000${NBSP}FCFA`],
    ['1250000', 'in', `+1${NBSP}250${NBSP}000${NBSP}FCFA`],
    ['999999999999', 'balance', `999${NBSP}999${NBSP}999${NBSP}999${NBSP}FCFA`],
    ['-1250', 'neutral', `−12,50${NBSP}€`],
  ] as const)('formats %s (%s)', (minor, kind, expected) => {
    const { container } = render(
      <MoneyAmount minor={minor} currency={minor === '-1250' ? 'EUR' : 'XOF'} kind={kind} />,
    );

    // Groupes : U+202F (Intl fr-FR) dans formatMoney, U+00A0 dans DESIGN_SYSTEM §8.1 : comparés en espaces.
    expect(container.textContent.replace(/\s/g, ' ')).toBe(expected.replace(/\s/g, ' '));
  });

  it('masks hidden amounts and keeps an accessible label', () => {
    render(<MoneyAmount minor="5000" currency="XOF" kind="balance" hidden />);

    expect(screen.getByLabelText('Montant masqué')).toHaveTextContent('FCFA');
  });

  it('shows an unknown currency raw', () => {
    render(<MoneyAmount minor="5000" currency="XYZ" />);

    expect(screen.getByText('5000')).toBeInTheDocument();
  });
});

describe('state components', () => {
  it('shows skeletons only after the loading delay', () => {
    vi.useFakeTimers();
    const { container } = render(<LoadingState rows={2} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY_MS);
    });

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('renders an empty state with its action', () => {
    render(<EmptyState body="Ajoutez-en une." action={<button type="button">Ajouter</button>} />);

    expect(screen.getByText("Rien pour l'instant.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('renders a network error with a retry action', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new NetworkError('offline')} onRetry={onRetry} />);

    expect(screen.getByText('Pas de connexion')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a server error with its support reference', () => {
    render(<ErrorState error={new ApiError(500, 'INTERNAL_ERROR', undefined, 'req-42')} compact />);

    expect(screen.getByRole('alert')).toHaveTextContent('Référence : req-42');
  });

  it.each([
    [ForbiddenState, 'Accès refusé'],
    [NotFoundState, 'Page introuvable'],
    [ModuleDisabledState, 'Ce module est désactivé'],
  ] as const)('renders %o', (Component, title) => {
    render(<Component />);

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('renders the banners with default and custom messages', () => {
    render(
      <>
        <ArchivedBanner />
        <StaleBanner message="Synchronisation en cours…" />
        <OfflineBanner />
      </>,
    );

    expect(screen.getByText(/est archivé/)).toBeInTheDocument();
    expect(screen.getByText('Synchronisation en cours…')).toBeInTheDocument();
    expect(screen.getByText(/hors ligne/)).toBeInTheDocument();
  });
});

describe('ConflictDialog', () => {
  it('offers reload, and keep-mine only when allowed', async () => {
    const onReload = vi.fn();
    const { rerender } = render(<ConflictDialog open onReload={onReload} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Garder ma saisie' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recharger la version actuelle' }));
    expect(onReload).toHaveBeenCalledTimes(1);

    rerender(<ConflictDialog open onReload={onReload} onKeepMine={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Garder ma saisie' })).toBeInTheDocument();
  });
});

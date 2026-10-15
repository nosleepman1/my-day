import type { IdeaStatus } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';

/**
 * Machine à états des idées (PRODUCT_SPEC §4.5). Une idée abandonnée peut être reprise ; une idée réalisée
 * peut revenir en cours. Les sauts en avant sont permis tant que l'idée n'est pas engagée (`IN_PROGRESS`).
 */
const TRANSITIONS: Readonly<Record<IdeaStatus, readonly IdeaStatus[]>> = {
  INBOX: ['TO_REVIEW', 'EVALUATED', 'SELECTED', 'ABANDONED'],
  TO_REVIEW: ['INBOX', 'EVALUATED', 'SELECTED', 'ABANDONED'],
  EVALUATED: ['TO_REVIEW', 'SELECTED', 'ABANDONED'],
  SELECTED: ['EVALUATED', 'IN_PROGRESS', 'ABANDONED'],
  IN_PROGRESS: ['SELECTED', 'REALIZED', 'ABANDONED'],
  REALIZED: ['IN_PROGRESS'],
  ABANDONED: ['INBOX', 'TO_REVIEW'],
};

/** Statuts depuis lesquels une idée peut être convertie en projet. */
export const CONVERTIBLE_IDEA_STATUSES: readonly IdeaStatus[] = [
  'INBOX',
  'TO_REVIEW',
  'EVALUATED',
  'SELECTED',
  'IN_PROGRESS',
];

export function canTransitionIdea(from: IdeaStatus, to: IdeaStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** @throws {DomainError} INVALID_STATE_TRANSITION */
export function assertIdeaTransition(from: IdeaStatus, to: IdeaStatus): void {
  if (!canTransitionIdea(from, to)) {
    throw new DomainError('INVALID_STATE_TRANSITION', "Ce changement de statut n'est pas permis.", {
      from,
      to,
    });
  }
}

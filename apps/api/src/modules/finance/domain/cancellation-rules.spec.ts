import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';

import { assertCanCancelTransaction, assertCancellationDoesNotViolateOverdraft } from './cancellation-rules';

describe('cancellation-rules (FINANCE_RULES §4.3, §5.1)', () => {
  it('allows cancelling a PENDING transaction even without a reason', () => {
    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'PENDING',
      });
    }).not.toThrow();
  });

  it('allows cancelling a VALIDATED transaction with a valid reason (>= 3 chars)', () => {
    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'VALIDATED',
        cancelReason: 'Erreur de saisie de montant',
      });
    }).not.toThrow();
  });

  it('rejects cancelling a VALIDATED transaction with missing or short reason', () => {
    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'VALIDATED',
      });
    }).toThrow(DomainError);

    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'VALIDATED',
        cancelReason: 'no',
      });
    }).toThrow(DomainError);

    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'VALIDATED',
        cancelReason: 'a'.repeat(501),
      });
    }).toThrow(DomainError);
  });

  it('rejects cancelling a transaction that is already CANCELLED', () => {
    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'CANCELLED',
        cancelReason: 'Annulation répétée',
      });
    }).toThrow(DomainError);
  });

  it('rejects cancelling a CUSTOMER_CREDIT child without parent', () => {
    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'VALIDATED',
        cancelReason: 'Annulation enfant',
        isChildTransaction: true,
        childTreatment: 'CUSTOMER_CREDIT',
      });
    }).toThrow(DomainError);
  });

  it('validates overdraft safety when cancelling a transaction that credited the account', () => {
    // Current balance 50000, credited 30000 -> after cancellation balance = 20000 -> safe
    expect(() => {
      assertCancellationDoesNotViolateOverdraft(50_000n, 30_000n, false);
    }).not.toThrow();

    // Current balance 20000, credited 30000, no overdraft -> after cancellation balance = -10000 -> rejected
    expect(() => {
      assertCancellationDoesNotViolateOverdraft(20_000n, 30_000n, false);
    }).toThrow(DomainError);

    // Current balance 20000, credited 30000, overdraft allowed up to 15000 -> after cancellation balance = -10000 -> allowed
    expect(() => {
      assertCancellationDoesNotViolateOverdraft(20_000n, 30_000n, true, 15_000n);
    }).not.toThrow();
  });
});

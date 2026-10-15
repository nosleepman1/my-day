import crypto from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { CurrencyCodeSchema, PositiveMoneyStringSchema } from '@orbit/contracts';

import type { CategoriesRepository } from '../../src/modules/finance/categories/categories.repository';
import type { CounterpartiesRepository } from '../../src/modules/finance/counterparties/counterparties.repository';
import {
  assertValidAdjustment,
  calculateReconciliation,
} from '../../src/modules/finance/domain/adjustment-rules';
import {
  assertSufficientFunds,
  calculateBalance,
  type LedgerEntryItem,
} from '../../src/modules/finance/domain/balance-calculator';
import {
  assertCanCancelTransaction,
  assertCancellationDoesNotViolateOverdraft,
} from '../../src/modules/finance/domain/cancellation-rules';
import {
  assertDestinationAmountMatches,
  convertCurrency,
} from '../../src/modules/finance/domain/fx-converter';
import {
  buildStandardLedgerEntries,
  buildTransferLedgerEntries,
} from '../../src/modules/finance/domain/ledger-entry-builder';
import { TransactionReferences } from '../../src/modules/finance/transactions/transaction-references';
import type { PrismaService } from '../../src/platform/database/prisma.service';
import { DomainError } from '../../src/platform/errors/domain-error';
import { IdempotencyService } from '../../src/platform/idempotency/idempotency.service';
import type { IdGeneratorPort } from '../../src/platform/ids/id-generator.port';
import type { ClockPort } from '../../src/platform/time/clock.port';

const USER_A = '01928000-0000-7000-8000-000000000001';
const USER_B = '01928000-0000-7000-8000-000000000002';
const ACCOUNT_WAVE_A = '01928000-0000-7000-8000-000000000010';
const ACCOUNT_ESPECES_A = '01928000-0000-7000-8000-000000000011';
const ACCOUNT_EUR_A = '01928000-0000-7000-8000-000000000012';
const CAT_FREELANCE_A = '01928000-0000-7000-8000-000000000020';
const CP_A = '01928000-0000-7000-8000-000000000030';

describe('FIN-xx Named Financial Rules Test Suite (PHASE-05 T16, FINANCE_RULES.md §6.6)', () => {
  it('[FIN-01] Entrée simple (FINANCE_RULES §6.6 / FIN-01)', () => {
    // Arrange: compte Wave (MOBILE_MONEY, XOF, solde initial 100 000). Catégorie Freelance.
    const openingBalance = 100_000n;
    const amount = 150_000n;

    // Act: INCOME STANDARD VALIDATED 150 000, destination Wave
    const entries = buildStandardLedgerEntries({
      type: 'INCOME',
      accountId: ACCOUNT_WAVE_A,
      accountCurrency: 'XOF',
      amountMinor: amount,
      currency: 'XOF',
    });

    // Assert: 1 écriture CREDIT 150 000 sur Wave
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      accountId: ACCOUNT_WAVE_A,
      direction: 'CREDIT',
      amountMinor: 150_000n,
      currency: 'XOF',
    });

    const items: LedgerEntryItem[] = entries.map((e) => ({
      direction: e.direction,
      amountMinor: e.amountMinor,
      status: 'VALIDATED',
    }));

    const balance = calculateBalance(openingBalance, items);
    expect(balance.realisedMinor).toBe(250_000n);
    expect(balance.projectedMinor).toBe(250_000n);
  });

  it('[FIN-02] Dépense simple (FINANCE_RULES §6.6 / FIN-02)', () => {
    // Arrange: compte Espèces (CASH, XOF, solde initial 50 000). Catégorie Transport.
    const openingBalance = 50_000n;
    const amount = 12_500n;

    // Act: EXPENSE STANDARD VALIDATED 12 500, source Espèces
    const entries = buildStandardLedgerEntries({
      type: 'EXPENSE',
      accountId: ACCOUNT_ESPECES_A,
      accountCurrency: 'XOF',
      amountMinor: amount,
      currency: 'XOF',
    });

    // Assert: 1 écriture DEBIT 12 500
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      accountId: ACCOUNT_ESPECES_A,
      direction: 'DEBIT',
      amountMinor: 12_500n,
      currency: 'XOF',
    });

    const items: LedgerEntryItem[] = entries.map((e) => ({
      direction: e.direction,
      amountMinor: e.amountMinor,
      status: 'VALIDATED',
    }));

    const balance = calculateBalance(openingBalance, items);
    expect(balance.realisedMinor).toBe(37_500n);
  });

  it('[FIN-03] Transfert interne même devise (FINANCE_RULES §6.6 / FIN-03)', () => {
    // Arrange: Wave solde initial 200 000 ; Espèces solde initial 0
    const waveOpening = 200_000n;
    const especesOpening = 0n;
    const transferAmount = 50_000n;

    // Act: TRANSFER 50 000 de Wave vers Espèces, VALIDATED
    const entries = buildTransferLedgerEntries({
      fromAccountId: ACCOUNT_WAVE_A,
      fromAccountCurrency: 'XOF',
      fromAmountMinor: transferAmount,
      toAccountId: ACCOUNT_ESPECES_A,
      toAccountCurrency: 'XOF',
      toAmountMinor: transferAmount,
    });

    // Assert: 2 écritures (DEBIT 50 000 Wave, CREDIT 50 000 Espèces)
    expect(entries).toHaveLength(2);
    const debit = entries.find((e) => e.accountId === ACCOUNT_WAVE_A)!;
    const credit = entries.find((e) => e.accountId === ACCOUNT_ESPECES_A)!;
    expect(debit.direction).toBe('DEBIT');
    expect(debit.amountMinor).toBe(50_000n);
    expect(credit.direction).toBe('CREDIT');
    expect(credit.amountMinor).toBe(50_000n);

    // Soldes mis à jour
    const waveBalance = calculateBalance(waveOpening, [
      { direction: debit.direction, amountMinor: debit.amountMinor, status: 'VALIDATED' },
    ]);
    const especesBalance = calculateBalance(especesOpening, [
      { direction: credit.direction, amountMinor: credit.amountMinor, status: 'VALIDATED' },
    ]);

    expect(waveBalance.realisedMinor).toBe(150_000n);
    expect(especesBalance.realisedMinor).toBe(50_000n);

    // Somme des soldes de la devise conservée
    const sumBefore = waveOpening + especesOpening;
    const sumAfter = waveBalance.realisedMinor + especesBalance.realisedMinor;
    expect(sumAfter).toBe(sumBefore);
    expect(sumAfter).toBe(200_000n);
  });

  it('[FIN-04] Transfert multi-devises avec taux explicite (FINANCE_RULES §6.6 / FIN-11)', () => {
    // Arrange: Banque EUR (EUR, solde initial 50 000 = 500,00 €) ; Wave (XOF, solde initial 0)
    const banqueEurOpening = 50_000n;
    const waveOpening = 0n;
    const srcMinor = 10_000n; // 100,00 €
    const rate = '655.957';

    // Act: calcul et conversion
    const destCalculated = convertCurrency(srcMinor, 'EUR', 'XOF', rate);

    expect(destCalculated).toBe(65_596n);

    // Validation du montant saisi avec tolérance ±1
    assertDestinationAmountMatches({
      srcMinor,
      srcCurrency: 'EUR',
      destMinor: 65_596n,
      destCurrency: 'XOF',
      rateString: rate,
    });

    const entries = buildTransferLedgerEntries({
      fromAccountId: ACCOUNT_EUR_A,
      fromAccountCurrency: 'EUR',
      fromAmountMinor: srcMinor,
      toAccountId: ACCOUNT_WAVE_A,
      toAccountCurrency: 'XOF',
      toAmountMinor: destCalculated,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      accountId: ACCOUNT_EUR_A,
      direction: 'DEBIT',
      amountMinor: 10_000n,
      currency: 'EUR',
    });
    expect(entries[1]).toEqual({
      accountId: ACCOUNT_WAVE_A,
      direction: 'CREDIT',
      amountMinor: 65_596n,
      currency: 'XOF',
    });

    const eurBalance = calculateBalance(banqueEurOpening, [
      { direction: 'DEBIT', amountMinor: srcMinor, status: 'VALIDATED' },
    ]);
    const xofBalance = calculateBalance(waveOpening, [
      { direction: 'CREDIT', amountMinor: destCalculated, status: 'VALIDATED' },
    ]);

    expect(eurBalance.realisedMinor).toBe(40_000n);
    expect(xofBalance.realisedMinor).toBe(65_596n);

    // Variante sans taux : rejetée
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor,
        srcCurrency: 'EUR',
        destMinor: 65_596n,
        destCurrency: 'XOF',
        rateString: undefined,
      });
    }).toThrow(DomainError);
  });

  it('[FIN-05] Transaction annulée avec rétablissement de solde (FINANCE_RULES §6.6 / FIN-09)', () => {
    // Arrange: Espèces solde initial 100 000
    const openingBalance = 100_000n;
    const txEntry: LedgerEntryItem = {
      direction: 'DEBIT',
      amountMinor: 20_000n,
      status: 'VALIDATED',
    };

    // Act 1: Dépense validée 20 000 -> solde 80 000
    const during = calculateBalance(openingBalance, [txEntry]);
    expect(during.realisedMinor).toBe(80_000n);

    // Act 2: Annulation avec motif « saisie en double »
    assertCanCancelTransaction({
      currentStatus: 'VALIDATED',
      cancelReason: 'Saisie en double',
    });

    const cancelledEntry: LedgerEntryItem = {
      ...txEntry,
      status: 'CANCELLED',
    };
    const after = calculateBalance(openingBalance, [cancelledEntry]);

    // Assert: statut CANCELLED, solde restauré à 100 000
    expect(after.realisedMinor).toBe(100_000n);

    // Seconde annulation -> 409 INVALID_STATE_TRANSITION
    expect(() => {
      assertCanCancelTransaction({
        currentStatus: 'CANCELLED',
        cancelReason: 'Seconde tentative',
      });
    }).toThrow(DomainError);
  });

  it('[FIN-06] Frais liés débités et annulés avec la transaction parente (FINANCE_RULES §7 / FIN-31 & FIN-32)', () => {
    // Arrange: Wave solde initial 100 000
    const openingBalance = 100_000n;
    const parentDebit: LedgerEntryItem = {
      direction: 'DEBIT',
      amountMinor: 25_000n,
      status: 'VALIDATED',
    };
    const feeDebit: LedgerEntryItem = {
      direction: 'DEBIT',
      amountMinor: 250n,
      status: 'VALIDATED',
    };

    // Act 1: EXPENSE 25 000 + frais 250 (créés ensemble)
    const balance = calculateBalance(openingBalance, [parentDebit, feeDebit]);
    expect(balance.realisedMinor).toBe(74_750n);

    // Act 2: Annulation du parent entraîne l'annulation des deux
    const cancelledParent: LedgerEntryItem = { ...parentDebit, status: 'CANCELLED' };
    const cancelledFee: LedgerEntryItem = { ...feeDebit, status: 'CANCELLED' };
    const balanceAfterCascade = calculateBalance(openingBalance, [cancelledParent, cancelledFee]);
    expect(balanceAfterCascade.realisedMinor).toBe(100_000n);

    // Act 3: Annuler seulement le frais (le parent reste VALIDATED)
    const balanceFeeOnlyCancelled = calculateBalance(openingBalance, [parentDebit, cancelledFee]);
    expect(balanceFeeOnlyCancelled.realisedMinor).toBe(75_000n);

    // Act 4: Dépassement de solde atomique avec frais
    expect(() => {
      assertSufficientFunds(25_000n, -(25_000n + 250n), false, 0n);
    }).toThrow(DomainError);
  });

  it('[FIN-07] Double requête idempotente (même clé = même réponse sans double écriture) (FINANCE_RULES §13 / FIN-10)', async () => {
    // Arrange: simulateur idempotence
    const mockPrisma = {
      idempotencyKey: {
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };
    const mockIds: IdGeneratorPort = { next: () => '01928000-0000-7000-8000-000000000099' };
    const mockClock: ClockPort = { now: () => new Date('2026-10-15T10:00:00.000Z') };

    const idempotencyService = new IdempotencyService(
      mockPrisma as unknown as PrismaService,
      mockIds,
      mockClock,
    );

    const validKey = 'idem-key-0123456789abcdef';
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ amount: '10000' }))
      .digest();

    // Act 1: première requête -> STARTED
    mockPrisma.idempotencyKey.findFirst.mockResolvedValueOnce(null);
    mockPrisma.idempotencyKey.create.mockResolvedValueOnce({});

    const step1 = await idempotencyService.start({
      userId: USER_A,
      scope: 'finance.transactions',
      key: validKey,
      requestHash,
    });
    expect(step1.status).toBe('STARTED');

    // Act 2: deuxième requête avec même clé et même hash -> REPLAYED
    mockPrisma.idempotencyKey.findFirst.mockResolvedValueOnce({
      id: 'idem-1',
      userId: USER_A,
      scope: 'finance.transactions',
      key: validKey,
      requestHash,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: { data: { id: 'tx-1', amountMinor: '10000' } },
      expiresAt: new Date('2026-10-22T10:00:00.000Z'),
    });

    const step2 = await idempotencyService.start({
      userId: USER_A,
      scope: 'finance.transactions',
      key: validKey,
      requestHash,
    });

    expect(step2.status).toBe('REPLAYED');
    if (step2.status === 'REPLAYED') {
      expect(step2.responseStatus).toBe(201);
      expect(step2.responseBody).toEqual({ data: { id: 'tx-1', amountMinor: '10000' } });
    }
  });

  it('[FIN-08] Rejeu idempotent avec corps différent (422/409) (FINANCE_RULES §13 / FIN-10)', async () => {
    const hashOriginal = crypto
      .createHash('sha256')
      .update(JSON.stringify({ amount: '10000' }))
      .digest();
    const hashDifferent = crypto
      .createHash('sha256')
      .update(JSON.stringify({ amount: '20000' }))
      .digest();

    const mockPrisma = {
      idempotencyKey: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'idem-1',
          userId: USER_A,
          scope: 'finance.transactions',
          key: 'idem-key-0123456789abcdef',
          requestHash: hashOriginal,
          status: 'COMPLETED',
          responseStatus: 201,
          responseBody: { data: { id: 'tx-1' } },
          expiresAt: new Date('2026-10-22T10:00:00.000Z'),
        }),
      },
    };
    const mockIds: IdGeneratorPort = { next: () => '01928000-0000-7000-8000-000000000099' };
    const mockClock: ClockPort = { now: () => new Date('2026-10-15T10:00:00.000Z') };

    const idempotencyService = new IdempotencyService(
      mockPrisma as unknown as PrismaService,
      mockIds,
      mockClock,
    );

    // Act & Assert: même clé avec corps différent -> 409 IDEMPOTENCY_REPLAY
    await expect(
      idempotencyService.start({
        userId: USER_A,
        scope: 'finance.transactions',
        key: 'idem-key-0123456789abcdef',
        requestHash: hashDifferent,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('[FIN-09] Découvert refusé sans découvert autorisé (409/422 INSUFFICIENT_FUNDS) (FINANCE_RULES §3.3 / FIN-23)', () => {
    // Arrange: Espèces solde initial 10 000, overdraftLimit = 0
    const currentBalance = 10_000n;

    // Act 1: EXPENSE 10 001 -> 422 INSUFFICIENT_FUNDS (available "10000", required "10001")
    expect(() => {
      assertSufficientFunds(currentBalance, -10_001n, false, 0n);
    }).toThrow(DomainError);

    // Act 2: EXPENSE 10 000 -> solde 0
    expect(() => {
      assertSufficientFunds(currentBalance, -10_000n, false, 0n);
    }).not.toThrow();

    // Act 3: Plafond fixé à 5 000, EXPENSE 5 000 depuis solde 0 -> solde -5 000 accepté
    expect(() => {
      assertSufficientFunds(0n, -5_000n, true, 5_000n);
    }).not.toThrow();
    // EXPENSE 1 supplémentaire depuis -5 000 -> refusé
    expect(() => {
      assertSufficientFunds(-5_000n, -1n, true, 5_000n);
    }).toThrow(DomainError);

    // Act 4: Annulation d'un crédit de 10 000 lorsque le solde courant est 2 000 sans découvert
    expect(() => {
      assertCancellationDoesNotViolateOverdraft(2_000n, 10_000n, false, 0n);
    }).toThrow(DomainError);
  });

  it('[FIN-10] Concurrence : deux dépenses parallèles ne peuvent dépasser le solde (FINANCE_RULES §17 / FIN-27)', () => {
    // Arrange: Compte solde initial 10 000, pas de découvert
    let sharedAccountBalance = 10_000n;
    const debitAmount = 8_000n;

    // Act: Deux opérations concurrentes de 8 000 s'exécutant sous verrou
    const results: { success: boolean; error?: string }[] = [];

    const executeDebit = () => {
      try {
        assertSufficientFunds(sharedAccountBalance, -debitAmount, false, 0n);
        sharedAccountBalance -= debitAmount;
        results.push({ success: true });
      } catch (err: unknown) {
        if (err instanceof DomainError) {
          results.push({ success: false, error: err.code });
        } else if (err instanceof Error) {
          results.push({ success: false, error: err.message });
        } else {
          results.push({ success: false, error: String(err) });
        }
      }
    };

    executeDebit();
    executeDebit();

    // Assert: exactement 1 succès et 1 échec INSUFFICIENT_FUNDS
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
    expect(results[1]?.error).toBe('INSUFFICIENT_FUNDS');
    expect(sharedAccountBalance).toBe(2_000n);
  });

  it('[FIN-11] Montant nul ou négatif refusé (422) (FINANCE_RULES §2.1 / FIN-13)', () => {
    // Montants nuls ou négatifs
    expect(PositiveMoneyStringSchema.safeParse('0').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('-100').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('-0').success).toBe(false);

    // Formats invalides
    expect(PositiveMoneyStringSchema.safeParse('00100').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('1.5').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('1e3').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse(' 100').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('+100').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse(100).success).toBe(false);

    // Dépassement 10^18
    expect(PositiveMoneyStringSchema.safeParse('1000000000000000001').success).toBe(false);

    // Montant valide
    expect(PositiveMoneyStringSchema.safeParse('10000').success).toBe(true);
  });

  it('[FIN-12] Devise absente ou incohérente refusée (422) (FINANCE_RULES §4.1 / FIN-14)', () => {
    // Validation du code devise
    expect(CurrencyCodeSchema.safeParse(undefined).success).toBe(false);
    expect(CurrencyCodeSchema.safeParse(null).success).toBe(false);
    expect(CurrencyCodeSchema.safeParse('xof').success).toBe(false); // minuscule interdite
    expect(CurrencyCodeSchema.safeParse('ZZZ').success).toBe(false); // inconnu
    expect(CurrencyCodeSchema.safeParse('XOF').success).toBe(true);

    expect(() => {
      buildStandardLedgerEntries({
        type: 'EXPENSE',
        accountId: ACCOUNT_ESPECES_A,
        accountCurrency: 'XOF',
        amountMinor: 1_000n,
        currency: 'EUR',
      });
    }).toThrow(DomainError);
  });

  it('[FIN-13] Ajustement de solde et rapprochement bancaire (FINANCE_RULES §4.4 / FIN-12)', () => {
    // Arrange: Banque solde initial 100 000. Relevé réel indique 95 000.
    const openingBalance = 100_000n;
    const statementEndingBalance = 95_000n;

    // Rapprochement calculé
    const recon = calculateReconciliation(openingBalance, statementEndingBalance);
    expect(recon.isBalanced).toBe(false);
    expect(recon.differenceMinor).toBe(-5_000n);
    expect(recon.adjustmentNeeded).toEqual({
      direction: 'DEBIT',
      amountMinor: 5_000n,
    });

    // Act 1: Ajustement DEBIT 5 000 avec motif
    assertValidAdjustment({
      amountMinor: 5_000n,
      direction: 'DEBIT',
      reason: 'Écart relevé du 2026-10-01',
    });

    const adjEntry: LedgerEntryItem = {
      direction: 'DEBIT',
      amountMinor: 5_000n,
      status: 'VALIDATED',
    };
    const balance = calculateBalance(openingBalance, [adjEntry]);
    expect(balance.realisedMinor).toBe(95_000n);

    // Sans motif -> rejeté
    expect(() => {
      assertValidAdjustment({
        amountMinor: 5_000n,
        direction: 'DEBIT',
        reason: '   ',
      });
    }).toThrow(DomainError);

    // Montant nul -> rejeté
    expect(() => {
      assertValidAdjustment({
        amountMinor: 0n,
        direction: 'DEBIT',
        reason: 'Ajustement nul',
      });
    }).toThrow(DomainError);
  });

  it('[FIN-14] Isolation stricte : accès ou transfert vers ressource d’un autre utilisateur renvoie 404 (ADR-007 / FIN-15)', async () => {
    const mockCategoriesRepo = {
      findById: vi.fn().mockImplementation((userId: string, id: string) => {
        if (userId === USER_A && id === CAT_FREELANCE_A) {
          return Promise.resolve({ id: CAT_FREELANCE_A, userId: USER_A, kind: 'INCOME' });
        }
        return Promise.resolve(null);
      }),
    };

    const mockCounterpartiesRepo = {
      findById: vi.fn().mockImplementation((userId: string, id: string) => {
        if (userId === USER_A && id === CP_A) {
          return Promise.resolve({ id: CP_A, userId: USER_A, name: 'Client A' });
        }
        return Promise.resolve(null);
      }),
    };

    const referencesValidator = new TransactionReferences(
      mockCategoriesRepo as unknown as CategoriesRepository,
      mockCounterpartiesRepo as unknown as CounterpartiesRepository,
    );

    // Utilisateur A accède à sa catégorie et contrepartie -> succès
    await expect(
      referencesValidator.validateCategory(USER_A, CAT_FREELANCE_A, 'INCOME'),
    ).resolves.not.toThrow();
    await expect(referencesValidator.validateCounterparty(USER_A, CP_A)).resolves.not.toThrow();

    // Utilisateur B tente d'utiliser la catégorie de A -> 404 NOT_FOUND
    await expect(referencesValidator.validateCategory(USER_B, CAT_FREELANCE_A, 'INCOME')).rejects.toThrow(
      DomainError,
    );

    // Utilisateur B tente d'utiliser la contrepartie de A -> 404 NOT_FOUND
    await expect(referencesValidator.validateCounterparty(USER_B, CP_A)).rejects.toThrow(DomainError);

    // Transfert vers le même compte -> SAME_ACCOUNT_TRANSFER
    expect(() => {
      buildTransferLedgerEntries({
        fromAccountId: ACCOUNT_WAVE_A,
        fromAccountCurrency: 'XOF',
        fromAmountMinor: 10_000n,
        toAccountId: ACCOUNT_WAVE_A,
        toAccountCurrency: 'XOF',
        toAmountMinor: 10_000n,
      });
    }).toThrow(DomainError);
  });
});

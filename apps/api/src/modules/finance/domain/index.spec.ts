import { describe, expect, it } from 'vitest';

import * as financeDomain from './index';

describe('finance domain index', () => {
  it('exports all domain functions and types', () => {
    expect(financeDomain.calculateBalance).toBeDefined();
    expect(financeDomain.assertSufficientFunds).toBeDefined();
    expect(financeDomain.assertAllowedTreatment).toBeDefined();
    expect(financeDomain.getEconomicImpact).toBeDefined();
    expect(financeDomain.convertCurrency).toBeDefined();
    expect(financeDomain.assertDestinationAmountMatches).toBeDefined();
    expect(financeDomain.buildStandardLedgerEntries).toBeDefined();
    expect(financeDomain.buildTransferLedgerEntries).toBeDefined();
    expect(financeDomain.assertCanCancelTransaction).toBeDefined();
    expect(financeDomain.assertCancellationDoesNotViolateOverdraft).toBeDefined();
  });
});

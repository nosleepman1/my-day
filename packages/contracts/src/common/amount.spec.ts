import { describe, expect, it } from 'vitest';

import { CURRENCIES } from '@orbit/money';

import { CurrencyCodeSchema, MoneyStringSchema, PositiveMoneyStringSchema } from './amount';

describe('amount schemas (API.md §6.1)', () => {
  it.each(['150000', '0', '-30000', '999999999999999999'])('accepts %j as a signed amount', (value) => {
    expect(MoneyStringSchema.parse(value)).toBe(value);
  });

  it.each(['01', '-0', '1.5', '1e3', '1 000', '+1', '1000000000000000000', 150000, null])(
    'rejects %j as a signed amount',
    (value) => {
      expect(MoneyStringSchema.safeParse(value).success).toBe(false);
    },
  );

  it('requires entered amounts to be strictly positive', () => {
    expect(PositiveMoneyStringSchema.parse('1')).toBe('1');
    expect(PositiveMoneyStringSchema.safeParse('0').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('-1').success).toBe(false);
  });

  it('lists exactly the currencies supported by @orbit/money', () => {
    expect([...CurrencyCodeSchema.options].sort()).toEqual(Object.keys(CURRENCIES).sort());
  });
});

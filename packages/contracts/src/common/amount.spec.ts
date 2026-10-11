import { describe, expect, it } from 'vitest';

import { BIGINT_MAX, BIGINT_MIN, CURRENCIES, MAX_AMOUNT_MINOR } from '@orbit/money';

import {
  AMOUNT_BIGINT_MAX,
  AMOUNT_BIGINT_MIN,
  CurrencyCodeSchema,
  MAX_ENTERED_AMOUNT_MINOR,
  MoneyStringSchema,
  PositiveMoneyStringSchema,
} from './amount';

describe('amount schemas (API.md §6.1)', () => {
  it.each(['150000', '0', '-30000', '9223372036854775807', '-9223372036854775808'])(
    'accepts %j as a signed amount',
    (value) => {
      expect(MoneyStringSchema.parse(value)).toBe(value);
    },
  );

  it.each(['01', '-0', '1.5', '1e3', '1 000', '+1', '9223372036854775808', 150000, null])(
    'rejects %j as a signed amount',
    (value) => {
      expect(MoneyStringSchema.safeParse(value).success).toBe(false);
    },
  );

  it('requires entered amounts to be strictly positive and at most 10^18', () => {
    expect(PositiveMoneyStringSchema.parse('1')).toBe('1');
    expect(PositiveMoneyStringSchema.parse('1000000000000000000')).toBe('1000000000000000000');
    expect(PositiveMoneyStringSchema.safeParse('1000000000000000001').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('0').success).toBe(false);
    expect(PositiveMoneyStringSchema.safeParse('-1').success).toBe(false);
  });

  it('uses exactly the bounds and currencies of @orbit/money', () => {
    expect(AMOUNT_BIGINT_MIN).toBe(BIGINT_MIN);
    expect(AMOUNT_BIGINT_MAX).toBe(BIGINT_MAX);
    expect(MAX_ENTERED_AMOUNT_MINOR).toBe(MAX_AMOUNT_MINOR);
    expect([...CurrencyCodeSchema.options].sort()).toEqual(Object.keys(CURRENCIES).sort());
  });
});

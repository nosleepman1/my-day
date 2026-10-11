import { describe, expect, it } from 'vitest';

import { formatMoney } from './format';
import { money } from './money';

const NBSP = '\u00A0';
const NNBSP = '\u202F';

describe('formatMoney', () => {
  it('formats FCFA without decimals and with French grouping', () => {
    expect(formatMoney(money(150_000n, 'XOF'))).toBe(`150${NNBSP}000${NBSP}FCFA`);
    expect(formatMoney(money(0n, 'XOF'))).toBe(`0${NBSP}FCFA`);
  });

  it('formats EUR with two decimals', () => {
    expect(formatMoney(money(1250n, 'EUR'))).toBe(`12,50${NBSP}€`);
    expect(formatMoney(money(5n, 'EUR'))).toBe(`0,05${NBSP}€`);
  });

  it('formats negative amounts', () => {
    expect(formatMoney(money(-30_000n, 'XOF'))).toBe(`-30${NNBSP}000${NBSP}FCFA`);
  });

  it('formats very large amounts exactly', () => {
    expect(formatMoney(money(9_007_199_254_740_993n, 'XOF'), { locale: 'en-US' })).toBe(
      `9,007,199,254,740,993${NBSP}FCFA`,
    );
    expect(formatMoney(money(123_456n, 'USD'), { locale: 'en-US' })).toBe(`1,234.56${NBSP}$`);
  });

  it('masks the amount when balances are hidden', () => {
    expect(formatMoney(money(150_000n, 'XOF'), { masked: true })).toBe(`•••••${NBSP}FCFA`);
  });
});

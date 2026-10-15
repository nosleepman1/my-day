import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '@/lib/http/client';

import { FormField } from './form-field';
import { MoneyInput } from './money-input';
import {
  groupMoneyInput,
  moneyInputIssue,
  moneyInputToMinor,
  normalizeMoneyInput,
} from './money-input-value';
import { applyApiFieldErrors, FormError, ValidationSummary } from './validation-errors';

const NBSP = ' ';

describe('money input values (ADR-008)', () => {
  it('keeps digits only for XOF and a decimal comma for EUR', () => {
    expect(normalizeMoneyInput('1 250 000 FCFA', 'XOF')).toBe('1250000');
    expect(normalizeMoneyInput('12.5', 'EUR')).toBe('12,5');
    expect(normalizeMoneyInput('1 2,3,4', 'EUR')).toBe('12,34');
  });

  it('groups thousands with a non-breaking space', () => {
    expect(groupMoneyInput('1250000')).toBe(`1${NBSP}250${NBSP}000`);
    expect(groupMoneyInput('1250,5')).toBe(`1${NBSP}250,5`);
  });

  it.each([
    ['', 'XOF', 'required'],
    ['12abc', 'XOF', 'invalid'],
    ['12,5', 'XOF', 'noDecimals'],
    ['12,345', 'EUR', 'tooManyDecimals'],
    ['0', 'XOF', 'notPositive'],
    ['9999999999999999999', 'XOF', 'tooLarge'],
    ['150 000', 'XOF', null],
    ['12,50', 'EUR', null],
  ] as const)('reports %j in %s as %s', (raw, currency, issue) => {
    expect(moneyInputIssue(raw, currency)).toBe(issue);
  });

  it('converts to a minor-unit string, never a float', () => {
    expect(moneyInputToMinor('150 000', 'XOF')).toBe('150000');
    expect(moneyInputToMinor('12,50', 'EUR')).toBe('1250');
    expect(moneyInputToMinor('0,1', 'EUR')).toBe('10');
  });
});

function ControlledMoney({ currency }: Readonly<{ currency: 'XOF' | 'EUR' }>): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <FormField label="Montant" hint="Aide">
      <MoneyInput value={value} onValueChange={setValue} currency={currency} />
    </FormField>
  );
}

describe('MoneyInput', () => {
  it('groups digits while typing and shows the currency suffix', async () => {
    render(<ControlledMoney currency="XOF" />);
    const input = screen.getByLabelText('Montant');

    await userEvent.type(input, '1250000');

    expect(input).toHaveValue(`1${NBSP}250${NBSP}000`);
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByText('FCFA')).toBeInTheDocument();
  });

  it('keeps a decimal point typed on a mobile keyboard (12. then 5 gives 12,5, not 125)', async () => {
    render(<ControlledMoney currency="EUR" />);
    const input = screen.getByLabelText('Montant');

    await userEvent.type(input, '12.5');

    expect(input).toHaveValue('12,5');
  });

  it('uses a decimal keyboard for EUR', () => {
    render(<ControlledMoney currency="EUR" />);

    expect(screen.getByLabelText('Montant')).toHaveAttribute('inputmode', 'decimal');
  });
});

describe('FormField', () => {
  it('links the label, hint and error to the control', () => {
    render(
      <FormField label="E-mail" hint="Aide" error="Requis">
        <input />
      </FormField>,
    );
    const input = screen.getByLabelText('E-mail');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Aide Requis');
  });
});

describe('API validation errors', () => {
  const validation = new ApiError(
    400,
    'VALIDATION_FAILED',
    [
      { path: ['email'], code: 'invalid_format', message: 'Adresse invalide.' },
      { path: ['unknown'], code: 'custom', message: 'Ignoré.' },
    ],
    'req-1',
  );

  it('maps known field issues onto the form and focuses the first one', () => {
    const setError = vi.fn();

    expect(applyApiFieldErrors(validation, setError, ['email'])).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(
      'email',
      { type: 'server', message: 'Adresse invalide.' },
      { shouldFocus: true },
    );
    expect(applyApiFieldErrors(new NetworkError('x'), setError, ['email'])).toBe(false);
  });

  it('shows a generic form error from the code, with the 429 delay', () => {
    const { rerender } = render(
      <FormError error={new ApiError(429, 'RATE_LIMITED', { retryAfterSeconds: 42 }, undefined)} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Réessayez dans 42 s.');

    rerender(<FormError error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('summarizes only from three errors', () => {
    const { rerender } = render(<ValidationSummary messages={['a', 'b']} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<ValidationSummary messages={['a', 'b', 'c']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

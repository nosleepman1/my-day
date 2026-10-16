import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmButton, enumOptions, NativeSelect, PageHeader } from './common';

describe('Finance common components', () => {
  it('renders PageHeader and NativeSelect', () => {
    render(
      <PageHeader title="Titre test">
        <NativeSelect
          aria-label="Sélection"
          options={[
            { value: '1', label: 'Option 1' },
            { value: '2', label: 'Option 2' },
          ]}
        />
      </PageHeader>,
    );

    expect(screen.getByRole('heading', { name: 'Titre test' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sélection' })).toBeInTheDocument();
  });

  it('manages ConfirmButton open, cancel and confirm actions', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmButton
        label="Supprimer"
        message="Êtes-vous sûr de vouloir supprimer cet élément ?"
        onConfirm={onConfirm}
      />,
    );

    const openBtn = screen.getByRole('button', { name: 'Supprimer' });
    await user.click(openBtn);

    expect(screen.getByText('Êtes-vous sûr de vouloir supprimer cet élément ?')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Annuler' });
    await user.click(cancelBtn);

    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(openBtn);
    const confirmBtn = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('creates enum options with and without empty option', () => {
    const withoutEmpty = enumOptions(['A', 'B'], (v) => `Label ${v}`);
    expect(withoutEmpty).toEqual([
      { value: 'A', label: 'Label A' },
      { value: 'B', label: 'Label B' },
    ]);

    const withEmpty = enumOptions(['A'], (v) => `Label ${v}`, 'Tous');
    expect(withEmpty).toEqual([
      { value: '', label: 'Tous' },
      { value: 'A', label: 'Label A' },
    ]);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';
import { Input } from './input';
import { Badge } from './misc';

describe('ui primitives (DESIGN_SYSTEM.md §5.1)', () => {
  it('renders a primary button of at least 44 px by default, as a real button', () => {
    render(<Button>Valider</Button>);

    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('min-h-11');
  });

  it('renders its child with the button style when asChild is set', () => {
    render(
      <Button asChild variant="link">
        <a href="/x">Lien</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Lien' }).className).toContain('text-primary');
  });

  it('marks an invalid input through aria-invalid', () => {
    render(<Input aria-invalid="true" aria-label="Adresse" />);

    expect(screen.getByLabelText('Adresse').className).toContain('aria-invalid:border-danger');
  });

  it('opens an accessible dialog with a labelled close button', async () => {
    render(
      <Dialog>
        <DialogTrigger>Ouvrir</DialogTrigger>
        <DialogContent closeLabel="Fermer">
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));

    expect(screen.getByRole('dialog', { name: 'Titre' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
  });

  it('renders a badge in the requested tone', () => {
    render(<Badge tone="success">Terminé</Badge>);

    expect(screen.getByText('Terminé').className).toContain('text-success');
  });
});

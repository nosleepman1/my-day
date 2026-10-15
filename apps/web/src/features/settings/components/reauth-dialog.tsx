import { useCallback, useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authApi } from '@/features/auth';
import { displayCodeOf } from '@/lib/http/api-error-message';

/** Annulation de la ré-authentification : l'action échoue sans toast (FRONTEND.md §3.4). */
export class ReauthCancelledError extends Error {
  override readonly name = 'ReauthCancelledError';
}

type Pending = Readonly<{
  retry: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}>;

type ReauthRunner = Readonly<{
  run: <T>(action: () => Promise<T>) => Promise<T>;
  dialog: JSX.Element;
}>;

/**
 * Exécute une action sensible ; sur `403 REAUTH_REQUIRED`, demande le mot de passe (`POST /auth/reauth`)
 * puis rejoue l'action une seule fois.
 */
export function useReauth(): ReauthRunner {
  // Toutes les actions en attente partagent la même confirmation (aucune promesse orpheline).
  const pending = useRef<Pending[]>([]);
  const [open, setOpen] = useState(false);

  const run = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    return action().catch((error: unknown) => {
      if (displayCodeOf(error) !== 'REAUTH_REQUIRED') throw error;
      return new Promise<T>((resolve, reject) => {
        pending.current.push({ retry: action, resolve: resolve as (value: unknown) => void, reject });
        setOpen(true);
      });
    });
  }, []);

  const settleAll = (handle: (item: Pending) => void): void => {
    const items = pending.current;
    pending.current = [];
    setOpen(false);
    items.forEach(handle);
  };
  const close = (): void => {
    settleAll((item) => {
      item.reject(new ReauthCancelledError('REAUTH_CANCELLED'));
    });
  };
  const confirmed = (): void => {
    settleAll((item) => {
      item.retry().then(item.resolve, item.reject);
    });
  };

  // Composant démonté pendant l'attente : les actions échouent proprement au lieu de rester en suspens.
  useEffect(
    () => () => {
      pending.current.forEach((item) => {
        item.reject(new ReauthCancelledError('REAUTH_CANCELLED'));
      });
      pending.current = [];
    },
    [],
  );

  return { run, dialog: <ReauthDialog open={open} onCancel={close} onConfirmed={confirmed} /> };
}

type ReauthDialogProps = Readonly<{ open: boolean; onCancel: () => void; onConfirmed: () => void }>;

function usePasswordConfirmation(onConfirmed: () => void): Readonly<{
  password: string;
  setPassword: (value: string) => void;
  error: unknown;
  busy: boolean;
  submit: (event: SyntheticEvent) => void;
  reset: () => void;
}> {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    setBusy(true);
    authApi
      .reauth({ password })
      .then(() => {
        setPassword('');
        setError(null);
        onConfirmed();
      }, setError)
      .finally(() => {
        setBusy(false);
      });
  };
  // Le mot de passe saisi ne survit jamais à la fermeture du dialogue.
  const reset = (): void => {
    setPassword('');
    setError(null);
  };
  return { password, setPassword, error, busy, submit, reset };
}

function ReauthDialog({ open, onCancel, onConfirmed }: ReauthDialogProps): JSX.Element {
  const { t } = useTranslation(['settings', 'common']);
  const { password, setPassword, error, busy, submit, reset } = usePasswordConfirmation(onConfirmed);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Pas d'annulation pendant la vérification : la session pourrait être ré-authentifiée sans rejeu.
        if (next || busy) return;
        reset();
        onCancel();
      }}
    >
      <DialogContent closeLabel={t('common:actions.close')}>
        <DialogHeader>
          <DialogTitle>{t('reauth.title')}</DialogTitle>
          <DialogDescription>{t('reauth.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField label={t('reauth.password')}>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
              }}
            />
          </FormField>
          <FormError error={error} />
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                reset();
                onCancel();
              }}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={busy || password === ''}>
              {t('reauth.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

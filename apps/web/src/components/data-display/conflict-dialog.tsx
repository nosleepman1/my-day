import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ConflictDialogProps = Readonly<{
  open: boolean;
  onReload: () => void;
  /** Absent pour une donnée financière : le rechargement est alors obligatoire (DESIGN_SYSTEM.md §6). */
  onKeepMine?: () => void;
  onOpenChange: (open: boolean) => void;
}>;

/** Conflit de version (409 `VERSION_CONFLICT`) : recharger, ou garder sa saisie quand c'est permis. */
export function ConflictDialog({
  open,
  onReload,
  onKeepMine,
  onOpenChange,
}: ConflictDialogProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('actions.close')}>
        <DialogHeader>
          <DialogTitle>{t('states.conflictTitle')}</DialogTitle>
          <DialogDescription>{t('states.conflictBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {onKeepMine !== undefined && (
            <Button variant="secondary" onClick={onKeepMine}>
              {t('states.conflictKeep')}
            </Button>
          )}
          <Button onClick={onReload}>{t('states.conflictReload')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

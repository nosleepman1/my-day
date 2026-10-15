import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { USER_MODULES, type UserModule } from '@orbit/contracts';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type ModuleSwitchesProps = Readonly<{
  enabled: readonly UserModule[];
  onToggle: (module: UserModule, on: boolean) => void;
  disabled?: boolean;
}>;

/** Liste des modules activables (ADR-024) : la zone Dev n'en fait jamais partie. */
export function ModuleSwitches({ enabled, onToggle, disabled = false }: ModuleSwitchesProps): JSX.Element {
  const { t } = useTranslation('settings');
  return (
    <ul className="divide-y divide-border">
      {USER_MODULES.map((module) => {
        const id = `module-${module}`;
        return (
          <li key={module} className="flex min-h-12 items-center justify-between gap-4 py-1">
            <Label htmlFor={id} className="text-body">
              {t(`modules.labels.${module}`)}
            </Label>
            <Switch
              id={id}
              checked={enabled.includes(module)}
              disabled={disabled}
              onCheckedChange={(on) => {
                onToggle(module, on);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Nouvel ensemble de modules, sans doublon et dans l'ordre canonique. */
export function toggleModule(enabled: readonly UserModule[], module: UserModule, on: boolean): UserModule[] {
  const next = new Set(enabled);
  if (on) next.add(module);
  else next.delete(module);
  return USER_MODULES.filter((candidate) => next.has(candidate));
}

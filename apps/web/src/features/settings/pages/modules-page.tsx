import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/data-display/states';
import { FormError } from '@/components/forms/validation-errors';
import { Card } from '@/components/ui/card';

import { usePreferences, useUpdatePreferences } from '../api/me.api';
import { ModuleSwitches, toggleModule } from '../components/module-switches';

/** `/settings/modules` : chaque bascule est enregistrée aussitôt ; la navigation suit (ADR-024). */
export function ModulesPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const preferences = usePreferences();
  const update = useUpdatePreferences();
  if (preferences.isPending) return <LoadingState />;
  if (preferences.isError)
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />;
  const enabled = preferences.data.data.enabledModules;
  return (
    <Card className="flex flex-col gap-4">
      <p className="text-small text-muted-foreground">{t('modules.intro')}</p>
      <FormError error={update.error} />
      <ModuleSwitches
        enabled={enabled}
        disabled={update.isPending}
        onToggle={(module, on) => {
          update.mutate({ enabledModules: toggleModule(enabled, module, on) });
        }}
      />
    </Card>
  );
}

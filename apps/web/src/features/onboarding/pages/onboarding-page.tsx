import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { PREFERENCE_CURRENCIES, type Preferences, type UserModule } from '@orbit/contracts';

import { ErrorState, LoadingState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModuleSwitches, toggleModule, usePreferences, useUpdatePreferences } from '@/features/settings';
import { availableTimeZones } from '@/lib/dates';

const STEPS = ['welcome', 'region', 'modules'] as const;

type Draft = Readonly<{
  timezone: string;
  defaultCurrency: Preferences['defaultCurrency'];
  enabledModules: readonly UserModule[];
}>;

type StepProps = Readonly<{ draft: Draft; onChange: (draft: Draft) => void }>;

function RegionStep({ draft, onChange }: StepProps): JSX.Element {
  const { t } = useTranslation('settings');
  const zones = useMemo(() => availableTimeZones(), []);
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('preferences.timezone')} hint={t('preferences.timezoneHint')}>
        <Input
          list="onboarding-zones"
          value={draft.timezone}
          onChange={(event) => {
            onChange({ ...draft, timezone: event.currentTarget.value });
          }}
        />
      </FormField>
      <datalist id="onboarding-zones">
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <FormField label={t('preferences.currency')}>
        <Select
          value={draft.defaultCurrency}
          onValueChange={(value) => {
            onChange({ ...draft, defaultCurrency: value as Draft['defaultCurrency'] });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PREFERENCE_CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {t(`preferences.currencies.${currency}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </div>
  );
}

function ModulesStep({ draft, onChange }: StepProps): JSX.Element {
  return (
    <ModuleSwitches
      enabled={draft.enabledModules}
      onToggle={(module, on) => {
        onChange({ ...draft, enabledModules: toggleModule(draft.enabledModules, module, on) });
      }}
    />
  );
}

type StepActionsProps = Readonly<{
  index: number;
  busy: boolean;
  onMove: (index: number) => void;
  onFinish: () => void;
}>;

function StepActions({ index, busy, onMove, onFinish }: StepActionsProps): JSX.Element {
  const { t } = useTranslation(['onboarding', 'common']);
  const last = index === STEPS.length - 1;
  return (
    <div className="flex justify-between gap-2">
      <Button
        variant="ghost"
        disabled={index === 0}
        onClick={() => {
          onMove(index - 1);
        }}
      >
        {t('common:actions.back')}
      </Button>
      <Button
        disabled={busy}
        onClick={
          last
            ? onFinish
            : () => {
                onMove(index + 1);
              }
        }
      >
        {last ? t('finish') : t('next')}
      </Button>
    </div>
  );
}

function OnboardingFlow({ saved }: Readonly<{ saved: Preferences }>): JSX.Element {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();
  const update = useUpdatePreferences();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    timezone: saved.timezone,
    defaultCurrency: saved.defaultCurrency,
    enabledModules: saved.enabledModules,
  });
  const step = STEPS[index] ?? 'welcome';
  const finish = (): void => {
    update.mutate(
      { ...draft, enabledModules: [...draft.enabledModules], onboardingCompleted: true },
      { onSuccess: () => void navigate('/', { replace: true }) },
    );
  };
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10"
    >
      <p className="text-caption text-muted-foreground">
        {t('step', { current: index + 1, total: STEPS.length })}
      </p>
      <Card className="flex flex-col gap-5 p-6">
        <h1 className="text-h2">{t(`${step}.title`)}</h1>
        <p className="text-body text-muted-foreground">{t(`${step}.body`)}</p>
        {step === 'region' && <RegionStep draft={draft} onChange={setDraft} />}
        {step === 'modules' && <ModulesStep draft={draft} onChange={setDraft} />}
        <FormError error={update.error} />
        <StepActions index={index} busy={update.isPending} onMove={setIndex} onFinish={finish} />
      </Card>
    </main>
  );
}

/** Onboarding du premier accès (PHASE-02 §3) : bienvenue, fuseau et devise, modules ; termine via `PATCH /me/preferences`. */
export function OnboardingPage(): JSX.Element {
  const preferences = usePreferences();
  if (preferences.isPending) return <LoadingState />;
  if (preferences.isError) {
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />;
  }
  return <OnboardingFlow saved={preferences.data.data} />;
}

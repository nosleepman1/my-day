import { useId, useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  DATE_FORMATS,
  LOCALES,
  PREFERENCE_CURRENCIES,
  UI_THEMES,
  type Preferences,
  type UpdatePreferencesRequest,
} from '@orbit/contracts';

import { StaleBanner } from '@/components/data-display/banners';
import { ErrorState, LoadingState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { availableTimeZones, deviceTimeZone } from '@/lib/dates';

import { usePreferences, useUpdatePreferences } from '../api/me.api';

type Draft = Pick<
  Preferences,
  'locale' | 'timezone' | 'defaultCurrency' | 'dateFormat' | 'weekStartsOn' | 'theme'
>;
type ThemeChange = (theme: Preferences['theme']) => void;

const WEEK_STARTS = ['1', '6', '7'] as const;

type ChoiceProps<T extends string> = Readonly<{
  label: string;
  value: T;
  options: readonly T[];
  labelOf: (option: T) => string;
  onChange: (value: T) => void;
  disabled?: (option: T) => boolean;
}>;

function Choice<T extends string>({
  label,
  value,
  options,
  labelOf,
  onChange,
  disabled,
}: ChoiceProps<T>): JSX.Element {
  return (
    <FormField label={label}>
      <Select
        value={value}
        onValueChange={(next) => {
          onChange(next as T);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} disabled={disabled?.(option) ?? false}>
              {labelOf(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function TimezoneField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (zone: string) => void }>): JSX.Element {
  const { t } = useTranslation('settings');
  const listId = useId();
  const zones = useMemo(() => availableTimeZones(), []);
  return (
    <>
      <FormField
        label={t('preferences.timezone')}
        hint={t('preferences.timezoneHint')}
        error={zones.includes(value) ? undefined : t('preferences.timezoneInvalid')}
      >
        <Input
          list={listId}
          value={value}
          autoComplete="off"
          onChange={(event) => {
            onChange(event.currentTarget.value);
          }}
        />
      </FormField>
      <datalist id={listId}>
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </>
  );
}

function changesOf(draft: Draft, saved: Preferences): UpdatePreferencesRequest {
  return Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => saved[key as keyof Draft] !== value),
  );
}

type FieldsProps = Readonly<{
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}>;

/** Région : langue, fuseau, devise. */
function PreferenceFields({ draft, update }: FieldsProps): JSX.Element {
  const { t } = useTranslation(['settings', 'nav']);
  return (
    <>
      <Choice
        label={t('preferences.locale')}
        value={draft.locale}
        options={LOCALES}
        labelOf={(option) => t(`preferences.locales.${option}`)}
        onChange={(value) => {
          update('locale', value);
        }}
        disabled={(option) => option !== 'fr'}
      />
      <TimezoneField
        value={draft.timezone}
        onChange={(value) => {
          update('timezone', value);
        }}
      />
      <Choice
        label={t('preferences.currency')}
        value={draft.defaultCurrency}
        options={PREFERENCE_CURRENCIES}
        labelOf={(option) => t(`preferences.currencies.${option}`)}
        onChange={(value) => {
          update('defaultCurrency', value);
        }}
      />
    </>
  );
}

/** Affichage : format de date, début de semaine, thème. */
function DisplayFields({ draft, update }: FieldsProps): JSX.Element {
  const { t } = useTranslation(['settings', 'nav']);
  return (
    <>
      <Choice
        label={t('preferences.dateFormat')}
        value={draft.dateFormat}
        options={DATE_FORMATS}
        labelOf={(option) => option}
        onChange={(value) => {
          update('dateFormat', value);
        }}
      />
      <Choice
        label={t('preferences.weekStartsOn')}
        value={String(draft.weekStartsOn) as (typeof WEEK_STARTS)[number]}
        options={WEEK_STARTS}
        labelOf={(option) => t(`preferences.weekdays.${option}`)}
        onChange={(value) => {
          update('weekStartsOn', Number(value));
        }}
      />
      <Choice
        label={t('preferences.theme')}
        value={draft.theme}
        options={UI_THEMES}
        labelOf={(option) => t(`nav:theme.${option}`)}
        onChange={(value) => {
          update('theme', value);
        }}
      />
    </>
  );
}

function PreferencesForm({
  saved,
  onThemeChange,
}: Readonly<{ saved: Preferences; onThemeChange: ThemeChange }>): JSX.Element {
  const { t } = useTranslation(['settings', 'common']);
  const mutation = useUpdatePreferences();
  const [draft, setDraft] = useState<Draft>(saved);
  const zones = useMemo(() => availableTimeZones(), []);
  const device = deviceTimeZone();
  const changes = changesOf(draft, saved);
  const update: FieldsProps['update'] = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const save = (): void => {
    mutation.mutate(changes, {
      onSuccess: () => {
        if (changes.theme !== undefined) onThemeChange(changes.theme);
        toast.success(t('saved'));
      },
    });
  };
  return (
    <Card className="flex flex-col gap-4">
      {device !== saved.timezone && (
        <StaleBanner message={t('preferences.deviceZone', { device, zone: saved.timezone })} />
      )}
      <PreferenceFields draft={draft} update={update} />
      <DisplayFields draft={draft} update={update} />
      <FormError error={mutation.error} />
      <Button
        className="self-end"
        disabled={mutation.isPending || Object.keys(changes).length === 0 || !zones.includes(draft.timezone)}
        onClick={save}
      >
        {t('common:actions.save')}
      </Button>
    </Card>
  );
}

/** `/settings/preferences` : langue, fuseau (recherche), devise, format de date, thème. */
export function PreferencesPage({ onThemeChange }: Readonly<{ onThemeChange: ThemeChange }>): JSX.Element {
  const preferences = usePreferences();
  if (preferences.isPending) return <LoadingState />;
  if (preferences.isError) {
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />;
  }
  return <PreferencesForm saved={preferences.data.data} onThemeChange={onThemeChange} />;
}

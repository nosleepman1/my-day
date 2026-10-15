import { CheckCircle2, Info } from 'lucide-react';
import { useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Card } from '@/components/ui/card';

type AuthLayoutProps = Readonly<{ title: string; children: ReactNode; footer?: ReactNode }>;

/** Mise en page des écrans publics : carte centrée, mobile d'abord. */
export function AuthLayout({ title, children, footer }: AuthLayoutProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <p className="text-h2 font-semibold tracking-tight">{t('appName')}</p>
      <Card className="flex w-full max-w-sm flex-col gap-5 p-6">
        <h1 className="text-h2">{title}</h1>
        {children}
      </Card>
      {footer !== undefined && <div className="flex flex-col items-center gap-2 text-small">{footer}</div>}
    </main>
  );
}

/** Message de confirmation ou d'information d'un écran public. */
export function Notice({
  tone = 'success',
  children,
}: Readonly<{ tone?: 'success' | 'info'; children: ReactNode }>): JSX.Element {
  const Icon = tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      role="status"
      className={
        tone === 'success'
          ? 'flex gap-2 rounded-md bg-success-surface px-3 py-2 text-small text-success'
          : 'flex gap-2 rounded-md bg-info-surface px-3 py-2 text-small text-info'
      }
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function BackToLogin(): JSX.Element {
  const { t } = useTranslation('auth');
  return (
    <Link to="/login" className="text-primary underline underline-offset-4">
      {t('backToLogin')}
    </Link>
  );
}

function readFragmentToken(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token !== null) {
    // Le jeton ne reste ni dans l'URL affichée ni dans l'historique (SECURITY.md §3.4).
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }
  return token;
}

/** Jeton lu une seule fois dans le fragment `#token=` des liens envoyés par e-mail. */
export function useFragmentToken(): string | null {
  const [token] = useState(readFragmentToken);
  return token;
}

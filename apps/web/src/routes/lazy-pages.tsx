import { lazy, Suspense, type JSX, type ReactNode } from 'react';

import { BootScreen } from '@/app/shell/boot-screen';
import type * as AuthExports from '@/features/auth';
import type * as FinanceExports from '@/features/finance';
import type * as OrganizationExports from '@/features/organization';
import type * as SettingsExports from '@/features/settings';

type AuthModule = typeof AuthExports;
type FinanceModule = typeof FinanceExports;
type SettingsModule = typeof SettingsExports;

/**
 * Pages chargées à la demande (FRONTEND.md §12) : chaque module forme son propre chunk ; seul le shell
 * (gardes, navigation, capture, client HTTP) reste dans le chunk initial.
 */
const auth = (): Promise<AuthModule> => import('@/features/auth');
const settings = (): Promise<SettingsModule> => import('@/features/settings');

export const LoginPage = lazy(() => auth().then((module) => ({ default: module.LoginPage })));
export const RegisterPage = lazy(() => auth().then((module) => ({ default: module.RegisterPage })));
export const ForgotPasswordPage = lazy(() =>
  auth().then((module) => ({ default: module.ForgotPasswordPage })),
);
export const VerifyEmailPage = lazy(() => auth().then((module) => ({ default: module.VerifyEmailPage })));
export const ResetPasswordPage = lazy(() => auth().then((module) => ({ default: module.ResetPasswordPage })));
export const ConfirmEmailChangePage = lazy(() =>
  auth().then((module) => ({ default: module.ConfirmEmailChangePage })),
);

export const HomePage = lazy(() =>
  import('@/features/dashboard').then((module) => ({ default: module.HomePage })),
);
export const OnboardingPage = lazy(() =>
  import('@/features/onboarding').then((module) => ({ default: module.OnboardingPage })),
);
export const SettingsLayout = lazy(() => settings().then((module) => ({ default: module.SettingsLayout })));
export const ProfilePage = lazy(() => settings().then((module) => ({ default: module.ProfilePage })));
export const PreferencesPage = lazy(() => settings().then((module) => ({ default: module.PreferencesPage })));
export const ModulesPage = lazy(() => settings().then((module) => ({ default: module.ModulesPage })));
export const SecurityPage = lazy(() => settings().then((module) => ({ default: module.SecurityPage })));

type OrganizationModule = typeof OrganizationExports;
const organization = (): Promise<OrganizationModule> => import('@/features/organization');

export const IdeasPage = lazy(() => organization().then((module) => ({ default: module.IdeasPage })));
export const IdeaDetailPage = lazy(() =>
  organization().then((module) => ({ default: module.IdeaDetailPage })),
);
export const ProjectsPage = lazy(() => organization().then((module) => ({ default: module.ProjectsPage })));
export const ProjectDetailPage = lazy(() =>
  organization().then((module) => ({ default: module.ProjectDetailPage })),
);
export const TasksPage = lazy(() => organization().then((module) => ({ default: module.TasksPage })));
export const TaskDetailPage = lazy(() =>
  organization().then((module) => ({ default: module.TaskDetailPage })),
);
export const NotesPage = lazy(() => organization().then((module) => ({ default: module.NotesPage })));
export const NoteDetailPage = lazy(() =>
  organization().then((module) => ({ default: module.NoteDetailPage })),
);
export const TagsPage = lazy(() => organization().then((module) => ({ default: module.TagsPage })));

const finance = (): Promise<FinanceModule> => import('@/features/finance');

export const FinanceOverviewPage = lazy(() =>
  finance().then((module) => ({ default: module.FinanceOverviewPage })),
);
export const AccountsPage = lazy(() => finance().then((module) => ({ default: module.AccountsPage })));
export const AccountDetailPage = lazy(() =>
  finance().then((module) => ({ default: module.AccountDetailPage })),
);
export const TransactionsPage = lazy(() =>
  finance().then((module) => ({ default: module.TransactionsPage })),
);
export const TransactionDetailPage = lazy(() =>
  finance().then((module) => ({ default: module.TransactionDetailPage })),
);
export const TransactionFormPage = lazy(() =>
  finance().then((module) => ({ default: module.TransactionFormPage })),
);
export const TransferFormPage = lazy(() =>
  finance().then((module) => ({ default: module.TransferFormPage })),
);

/** Écran de démarrage pendant le chargement d'une page hors shell (publique ou onboarding). */
export function Suspended({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return <Suspense fallback={<BootScreen />}>{children}</Suspense>;
}

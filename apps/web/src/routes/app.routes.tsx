import type { JSX } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { ModuleGate, NotFoundPage, RequireAuth, RequireOnboarding, RoleGate } from '@/app/guards/guards';
import { CURRENT_PHASE, NAV_ENTRIES } from '@/app/navigation/registry';
import { useSession } from '@/app/session/session';
import { AppShell } from '@/app/shell/app-shell';
import { ComingSoon } from '@/app/shell/coming-soon';
import { MorePage } from '@/app/shell/more-page';
import { useTheme } from '@/app/theme';

import {
  AccountDetailPage,
  AccountsPage,
  FinanceOverviewPage,
  HomePage,
  IdeaDetailPage,
  IdeasPage,
  ModulesPage,
  NoteDetailPage,
  NotesPage,
  OnboardingPage,
  PreferencesPage,
  ProfilePage,
  ProjectDetailPage,
  ProjectsPage,
  SecurityPage,
  SettingsLayout,
  Suspended,
  TagsPage,
  TaskDetailPage,
  TasksPage,
} from './lazy-pages';

/** Finances (PHASE-05) : chaque écran est gardé par son module (`enabled_modules`, ADR-024). */
const financeRoutes: RouteObject[] = [
  {
    path: '/finance',
    element: <ModuleGate module="finance" />,
    children: [
      { index: true, element: <FinanceOverviewPage /> },
      {
        path: 'accounts',
        children: [
          { index: true, element: <AccountsPage /> },
          { path: ':id', element: <AccountDetailPage /> },
        ],
      },
    ],
  },
];

/** Organisation (PHASE-04) : chaque écran est gardé par son module (`enabled_modules`, ADR-024). */
const organizationRoutes: RouteObject[] = [
  { module: 'tasks', path: '/tasks', list: <TasksPage />, detail: <TaskDetailPage /> },
  { module: 'ideas', path: '/ideas', list: <IdeasPage />, detail: <IdeaDetailPage /> },
  { module: 'projects', path: '/projects', list: <ProjectsPage />, detail: <ProjectDetailPage /> },
  { module: 'notes', path: '/notes', list: <NotesPage />, detail: <NoteDetailPage /> },
].map(({ module, path, list, detail }) => ({
  path,
  element: <ModuleGate module={module as 'tasks'} />,
  children: [
    { index: true, element: list },
    { path: ':id', element: detail },
  ],
}));

function HomeRoute(): JSX.Element {
  const { user } = useSession();
  return <HomePage user={user} />;
}

function PreferencesRoute(): JSX.Element {
  const { setTheme } = useTheme();
  return <PreferencesPage onThemeChange={setTheme} />;
}

/** Modules pas encore livrés : la route existe, gardée par module ou par rôle (registre de navigation). */
const upcomingRoutes: RouteObject[] = NAV_ENTRIES.filter((entry) => entry.phase > CURRENT_PHASE).map(
  (entry) => {
    const page = <ComingSoon phase={entry.phase} />;
    if (entry.role === 'ADMIN') return { path: `${entry.path}/*`, element: <RoleGate>{page}</RoleGate> };
    if (entry.module !== undefined) {
      return { path: `${entry.path}/*`, element: <ModuleGate module={entry.module}>{page}</ModuleGate> };
    }
    return { path: `${entry.path}/*`, element: page };
  },
);

/** Routes authentifiées (FRONTEND.md §9.1) : session, onboarding, puis le shell. */
export const appRoutes: RouteObject[] = [
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/onboarding',
        element: (
          <Suspended>
            <OnboardingPage />
          </Suspended>
        ),
      },
      {
        element: <RequireOnboarding />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <HomeRoute /> },
              { path: '/more', element: <MorePage /> },
              { path: '/capture', element: <Navigate to="/" replace /> },
              {
                path: '/settings',
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <Navigate to="/settings/profile" replace /> },
                  { path: 'profile', element: <ProfilePage /> },
                  { path: 'preferences', element: <PreferencesRoute /> },
                  { path: 'modules', element: <ModulesPage /> },
                  { path: 'security', element: <SecurityPage /> },
                  { path: 'tags', element: <TagsPage /> },
                ],
              },
              ...organizationRoutes,
              ...financeRoutes,
              ...upcomingRoutes,
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

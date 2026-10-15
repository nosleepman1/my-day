import type { RouteObject } from 'react-router';

import { PublicOnly } from '@/app/guards/guards';
import { safeNextPath } from '@/app/session/session';
import { SystemStatusPage } from '@/features/system';

import {
  ConfirmEmailChangePage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  Suspended,
  VerifyEmailPage,
} from './lazy-pages';

/** Routes publiques (FRONTEND.md §9.1) ; un utilisateur connecté est renvoyé vers l'application. */
export const publicRoutes: RouteObject[] = [
  {
    element: <PublicOnly />,
    children: [
      {
        path: '/login',
        element: (
          <Suspended>
            <LoginPage resolveNext={safeNextPath} />
          </Suspended>
        ),
      },
      {
        path: '/register',
        element: (
          <Suspended>
            <RegisterPage />
          </Suspended>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <Suspended>
            <ForgotPasswordPage />
          </Suspended>
        ),
      },
    ],
  },
  // Liens reçus par e-mail : utilisables connecté ou non.
  {
    path: '/verify-email',
    element: (
      <Suspended>
        <VerifyEmailPage />
      </Suspended>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <Suspended>
        <ResetPasswordPage />
      </Suspended>
    ),
  },
  {
    path: '/confirm-email-change',
    element: (
      <Suspended>
        <ConfirmEmailChangePage />
      </Suspended>
    ),
  },
  { path: '/status', element: <SystemStatusPage /> },
];

import './styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { AppProviders } from './app/providers';
import { createQueryClient } from './app/query-client';
import { createAppRouter } from './app/router';

const container = document.getElementById('root');
if (container === null) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <AppProviders queryClient={createQueryClient()}>
      <RouterProvider router={createAppRouter()} />
    </AppProviders>
  </StrictMode>,
);

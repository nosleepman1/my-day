import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';

import { SystemStatusPage } from './system-status-page';

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SystemStatusPage />
    </QueryClientProvider>,
  );
}

describe('SystemStatusPage', () => {
  it('shows that the API is reachable', async () => {
    server.use(http.get('/api/v1/health/live', () => HttpResponse.json({ data: { status: 'ok' } })));

    renderPage();

    expect(screen.getByRole('heading', { name: 'ORBIT' })).toBeInTheDocument();
    expect(await screen.findByText('API OK')).toBeInTheDocument();
  });

  it('shows an error state when the API cannot be reached', async () => {
    server.use(http.get('/api/v1/health/live', () => HttpResponse.error()));

    renderPage();

    expect(await screen.findByText('API injoignable')).toBeInTheDocument();
  });
});

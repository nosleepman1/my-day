import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnvironmentBanner } from '@/components/environment-banner';

import { initErrorReporting, scrubWebEvent } from './sentry';

describe('web error reporting', () => {
  it('keeps only the user UUID and drops the request', () => {
    const event = scrubWebEvent({
      message: 'boom',
      request: { url: 'https://orbit.example.com/reset-password#token=abc', headers: { cookie: 'x' } },
      user: { id: 'u-1', email: 'a@example.com', ip_address: '1.2.3.4' },
    });

    expect(event).toEqual({ message: 'boom', user: { id: 'u-1' } });
    expect(scrubWebEvent({ message: 'x', user: { email: 'a@example.com' } })).toEqual({ message: 'x' });
  });

  it('does not load the SDK without a DSN', async () => {
    await expect(initErrorReporting({})).resolves.toBe(false);
    await expect(initErrorReporting({ VITE_SENTRY_DSN: '' })).resolves.toBe(false);
  });

  it('initializes Sentry when DSN is provided', async () => {
    const initMock = vi.fn();
    vi.doMock('@sentry/react', () => ({
      init: initMock,
    }));

    const result = await initErrorReporting({
      VITE_SENTRY_DSN: 'https://key@sentry.example.com/123',
      VITE_APP_ENV: 'staging',
      VITE_APP_VERSION: 'v1.0.0',
    });

    expect(result).toBe(true);
    expect(initMock).toHaveBeenCalledOnce();
    const config = initMock.mock.calls[0]?.[0] as { beforeSend: (e: unknown) => unknown };
    expect(config.beforeSend({ message: 'test' })).toEqual({ message: 'test' });

    // Test default environment and release
    await initErrorReporting({
      VITE_SENTRY_DSN: 'https://key@sentry.example.com/123',
    });
  });
});

describe('EnvironmentBanner', () => {
  it('flags staging and previews, never production', () => {
    const { rerender } = render(<EnvironmentBanner appEnv="staging" />);
    expect(screen.getByRole('note')).toHaveTextContent('STAGING : environnement de test');

    rerender(<EnvironmentBanner appEnv="production" />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(<EnvironmentBanner appEnv={undefined} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

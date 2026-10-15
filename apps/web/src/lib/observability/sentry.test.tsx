import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

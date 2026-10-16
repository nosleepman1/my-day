import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useInstallPrompt } from './use-install-prompt';

describe('useInstallPrompt', () => {
  it('returns null initially and captures beforeinstallprompt event', () => {
    const { result, unmount } = renderHook(() => useInstallPrompt());
    expect(result.current).toBeNull();

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void> };
    event.prompt = mockPrompt;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(result.current).toBeTypeOf('function');

    act(() => {
      result.current?.();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(result.current).toBeNull();

    unmount();
  });

  it('resets deferred prompt on appinstalled event', () => {
    const { result, unmount } = renderHook(() => useInstallPrompt());

    const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void> };
    event.prompt = vi.fn().mockResolvedValue(undefined);

    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current).toBeTypeOf('function');

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current).toBeNull();

    unmount();
  });
});

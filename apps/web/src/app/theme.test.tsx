import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, ThemeProvider, useTheme } from './theme';

function mockSystemDark(dark: boolean): void {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: dark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
}

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => {
        setTheme('DARK');
      }}
    >
      {theme}
    </button>
  );
}

describe('theme (DESIGN_SYSTEM.md §2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('applies dark and light explicitly and remembers the choice', () => {
    mockSystemDark(false);

    applyTheme('DARK');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('orbit:theme')).toBe('dark');

    applyTheme('LIGHT');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('orbit:theme')).toBe('light');
  });

  it('follows the system in automatic mode', () => {
    mockSystemDark(true);

    applyTheme('SYSTEM');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('orbit:theme')).toBe('system');
  });

  it('exposes the preference through ThemeProvider and updates it', () => {
    mockSystemDark(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button').textContent).toBe('SYSTEM');
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByRole('button').textContent).toBe('DARK');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

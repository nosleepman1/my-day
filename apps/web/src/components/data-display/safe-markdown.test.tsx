import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { parseMarkdown, safeHref } from './markdown-blocks';
import { SafeMarkdown } from './safe-markdown';

describe('SafeMarkdown (SECURITY.md, PHASE-04 T11)', () => {
  it('renders headings, lists, checklists, quotes and code', () => {
    const { container } = renderWithProviders(
      <SafeMarkdown
        source={[
          '# Réunion',
          'Point **important** et *nuancé* avec `code`.',
          '- un',
          '- deux',
          '1. premier',
          '- [x] fait',
          '- [ ] à faire',
          '> citation',
          '```',
          'const x = 1;',
          '```',
        ].join('\n')}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Réunion' })).toBeInTheDocument();
    expect(screen.getByText('important').tagName).toBe('STRONG');
    expect(screen.getByText('nuancé').tagName).toBe('EM');
    expect(container.querySelectorAll('ul.list-disc > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(1);
    expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([
      true,
      false,
    ]);
    expect(container.querySelector('blockquote')?.textContent).toBe('citation');
    expect(container.querySelector('pre code')?.textContent).toBe('const x = 1;');
  });

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">clic</a>',
    '<iframe src="https://evil.example"></iframe>',
  ])('never interprets raw HTML: %s', (source) => {
    const { container } = renderWithProviders(<SafeMarkdown source={source} />);
    expect(container.querySelector('script, img, iframe')).toBeNull();
    // Une adresse http(s) du texte peut devenir un lien sûr ; jamais un autre schéma.
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    }
    expect(container.textContent).toContain(source);
  });

  it('keeps only http(s) and mailto links, opened safely', () => {
    const { container } = renderWithProviders(
      <SafeMarkdown
        source={
          '[site](https://orbit.example) [mal](javascript:alert(1)) [data](data:text/html;base64,x) https://exemple.sn mail [écrire](mailto:a@b.sn)'
        }
      />,
    );
    const links = [...container.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://orbit.example',
      'https://exemple.sn',
      'mailto:a@b.sn',
    ]);
    for (const link of links) expect(link.getAttribute('rel')).toContain('noopener noreferrer');
    expect(container.textContent).toContain('mal');
  });

  it('rejects dangerous URL schemes whatever their case or spacing', () => {
    expect(safeHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHref(' vbscript:x')).toBeNull();
    expect(safeHref('https://ok.example/a?b=c')).toBe('https://ok.example/a?b=c');
  });

  it('stays linear on unclosed markers (no quadratic parsing)', () => {
    const started = performance.now();
    parseMarkdown(`${'['.repeat(100_000)} ${'_a'.repeat(50_000)} ${'*'.repeat(100_000)}`);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it('parses an empty document to no block', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n')).toEqual([]);
  });
});

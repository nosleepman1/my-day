import { describe, expect, it } from 'vitest';

import { CliUsageError, parseCliArgs } from './cli-args';

describe('parseCliArgs', () => {
  it('reads create-admin with its e-mail and the optional --force', () => {
    expect(parseCliArgs(['create-admin', '--email', 'abdou@example.test'])).toEqual({
      command: 'create-admin',
      email: 'abdou@example.test',
      force: false,
    });
    expect(parseCliArgs(['create-admin', '--force', '--email', 'abdou@example.test']).force).toBe(true);
  });

  it.each([
    ['no command', []],
    ['an unknown command', ['drop-database']],
    ['a missing e-mail', ['create-admin']],
    ['an e-mail flag without value', ['create-admin', '--email']],
    ['an invalid e-mail', ['create-admin', '--email', 'nope']],
    ['an unknown option', ['create-admin', '--email', 'a@example.test', '--yes']],
  ])('refuses %s', (_label, argv) => {
    expect(() => parseCliArgs(argv)).toThrow(CliUsageError);
  });
});

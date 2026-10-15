import { EmailSchema } from '@orbit/contracts';

export type CliCommand = Readonly<{ command: 'create-admin'; email: string; force: boolean }>;

export const CLI_USAGE = 'Usage : pnpm --filter @orbit/api cli create-admin --email <adresse> [--force]';

export class CliUsageError extends Error {
  override readonly name = 'CliUsageError';
}

/** Lecture stricte des arguments : toute option inconnue ou manquante est refusée. */
export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [command, ...options] = argv;
  if (command !== 'create-admin') throw new CliUsageError(CLI_USAGE);
  let email: string | undefined;
  let force = false;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === '--force') {
      force = true;
    } else if (option === '--email' && options[index + 1] !== undefined) {
      email = options[index + 1];
      index += 1;
    } else {
      throw new CliUsageError(CLI_USAGE);
    }
  }
  const parsed = EmailSchema.safeParse(email ?? '');
  if (!parsed.success) throw new CliUsageError(`Adresse e-mail invalide. ${CLI_USAGE}`);
  return { command, email: parsed.data, force };
}

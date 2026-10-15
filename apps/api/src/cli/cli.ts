import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { AdminProvisioningService } from '../modules/users';

import { parseCliArgs } from './cli-args';

const GENERATED_PASSWORD_BYTES = 24;

/** Saisie sans écho dans un terminal ; le mot de passe n'apparaît jamais à l'écran. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = prompt as unknown as { _writeToOutput: (chunk: string) => void };
    let muted = false;
    output._writeToOutput = (chunk) => {
      if (!muted) process.stdout.write(chunk);
    };
    prompt.question(question, (answer) => {
      prompt.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const generated: { password: string | null } = { password: null };
  try {
    const result = await app.get(AdminProvisioningService).provision({
      email: args.email,
      force: args.force,
      password: async () => {
        if (process.stdin.isTTY) return promptHidden('Mot de passe du compte ADMIN : ');
        generated.password = randomBytes(GENERATED_PASSWORD_BYTES).toString('base64url');
        return generated.password;
      },
    });
    process.stdout.write(`create-admin : ${result} (${args.email})\n`);
    if (generated.password !== null) {
      process.stdout.write(`Mot de passe généré, affiché une seule fois : ${generated.password}\n`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

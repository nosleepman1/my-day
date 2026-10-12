import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSmtpTransport, SmtpMailAdapter } from '../../../src/platform/mail/smtp-mail.adapter';

/** Même image que `infra/compose/compose.dev.yml`. */
const MAILPIT_IMAGE = 'axllent/mailpit:v1.27';
const SMTP_PORT = 1025;
const HTTP_PORT = 8025;
const FROM = 'ORBIT <no-reply@orbit.localhost>';
const TO = 'aminata.diop@example.test';
const LINK = 'http://localhost:5173/verify-email#token=tok_123';

interface MailpitSummary {
  ID: string;
  Subject: string;
  From: { Address: string };
  To: { Address: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mailpit API ${url} answered ${response.status}`);
  return (await response.json()) as T;
}

describe('SmtpMailAdapter against Mailpit', () => {
  let mailpit: StartedTestContainer;
  let apiBase: string;

  beforeAll(async () => {
    mailpit = await new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(SMTP_PORT, HTTP_PORT)
      .withWaitStrategy(Wait.forHttp('/readyz', HTTP_PORT))
      .start();
    apiBase = `http://${mailpit.getHost()}:${mailpit.getMappedPort(HTTP_PORT)}/api/v1`;
  });

  afterAll(async () => {
    await mailpit.stop();
  });

  it('delivers a French verification e-mail with the link in the fragment', async () => {
    // Même choix que la configuration par défaut : une IP, pour éviter la résolution DNS de nodemailer.
    const smtpHost = mailpit.getHost() === 'localhost' ? '127.0.0.1' : mailpit.getHost();
    const transport = createSmtpTransport(smtpHost, mailpit.getMappedPort(SMTP_PORT));
    const adapter = new SmtpMailAdapter(transport, FROM);

    await adapter.send({
      to: TO,
      template: 'email-verification',
      data: { verifyUrl: LINK, expiresInHours: 24 },
    });

    const { messages } = await getJson<{ messages: MailpitSummary[] }>(`${apiBase}/messages`);
    const [summary] = messages;
    expect(summary?.To[0]?.Address).toBe(TO);
    expect(summary?.From.Address).toBe('no-reply@orbit.localhost');
    expect(summary?.Subject).toMatch(/^ORBIT · /);

    const message = await getJson<{ Text: string; HTML: string }>(`${apiBase}/message/${summary?.ID ?? ''}`);
    expect(message.Text).toContain(LINK);
    expect(message.HTML).toContain(`href="${LINK}"`);
  });
});

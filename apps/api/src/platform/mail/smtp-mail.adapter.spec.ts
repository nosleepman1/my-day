import { describe, expect, it, vi } from 'vitest';

import { MailDeliveryError } from './mail-delivery.error';
import {
  AllowlistMailAdapter,
  createSmtpTransport,
  isAllowlisted,
  SmtpMailAdapter,
  type SmtpSender,
} from './smtp-mail.adapter';

const FROM = 'ORBIT <no-reply@orbit.localhost>';
const TO = 'aminata.diop@example.test';
const DATA = { verifyUrl: 'http://localhost:5173/verify-email#token=abc', expiresInHours: 24 };

describe('SmtpMailAdapter', () => {
  it('sends the rendered message from the configured sender', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'id-1' });

    await new SmtpMailAdapter({ sendMail }, FROM).send({
      to: TO,
      template: 'email-verification',
      data: DATA,
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [message] = sendMail.mock.calls[0] as [Record<string, string>];
    expect(message['from']).toBe(FROM);
    expect(message['to']).toBe(TO);
    expect(message['subject']).toMatch(/^ORBIT · /);
    expect(message['text']).toContain(DATA.verifyUrl);
    expect(message['html']).toContain('<html lang="fr">');
  });

  it('wraps transport failures without leaking the recipient address', async () => {
    const sender: SmtpSender = { sendMail: vi.fn().mockRejectedValue(new Error(`550 rejected ${TO}`)) };
    const adapter = new SmtpMailAdapter(sender, FROM);

    const error: unknown = await adapter
      .send({ to: TO, template: 'email-verification', data: DATA })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MailDeliveryError);
    expect((error as MailDeliveryError).message).toBe('Mail delivery failed (template email-verification)');
    expect((error as MailDeliveryError).cause).toBeInstanceOf(Error);
  });

  it('refuses a recipient containing a line break before reaching the transport', async () => {
    const sendMail = vi.fn();

    await expect(
      new SmtpMailAdapter({ sendMail }, FROM).send({
        to: `${TO}\nBcc: x@example.test`,
        template: 'email-verification',
        data: DATA,
      }),
    ).rejects.toBeInstanceOf(MailDeliveryError);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('staging allowlist', () => {
  const ALLOWLIST = ['@example.test', 'owner@example.org'];

  it('matches a listed address or a listed domain, case-insensitively', () => {
    expect(isAllowlisted('Aminata.Diop@Example.TEST', ALLOWLIST)).toBe(true);
    expect(isAllowlisted('owner@example.org', ALLOWLIST)).toBe(true);
    expect(isAllowlisted('someone@example.org', ALLOWLIST)).toBe(false);
    expect(isAllowlisted('x@notexample.test', ALLOWLIST)).toBe(false);
  });

  it('never sends to a recipient outside the allowlist', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const adapter = new AllowlistMailAdapter(new SmtpMailAdapter({ sendMail }, FROM), ALLOWLIST);

    await adapter.send({ to: TO, template: 'email-verification', data: DATA });
    await expect(
      adapter.send({ to: 'real.user@gmail.example', template: 'email-verification', data: DATA }),
    ).rejects.toBeInstanceOf(MailDeliveryError);

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('refuses a recipient list smuggled behind an allowlisted address', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const adapter = new AllowlistMailAdapter(new SmtpMailAdapter({ sendMail }, FROM), ALLOWLIST);

    await expect(
      adapter.send({
        to: 'victim@gmail.example, x@example.test',
        template: 'email-verification',
        data: DATA,
      }),
    ).rejects.toBeInstanceOf(MailDeliveryError);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('createSmtpTransport', () => {
  it('builds plain, STARTTLS and implicit TLS transports', () => {
    expect(createSmtpTransport('127.0.0.1', 1025)).toBeDefined();
    expect(
      createSmtpTransport('smtp-relay.example.com', 587, { security: 'starttls', user: 'u', password: 'p' }),
    ).toBeDefined();
    expect(createSmtpTransport('smtp.example.com', 465, { security: 'tls' })).toBeDefined();
  });
});

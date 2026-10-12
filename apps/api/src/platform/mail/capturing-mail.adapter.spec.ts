import { describe, expect, it } from 'vitest';

import { CapturingMailAdapter } from './capturing-mail.adapter';
import { MailDeliveryError } from './mail-delivery.error';

const TO = 'aminata.diop@example.test';
const LINK = 'http://localhost:5173/verify-email#token=tok_EN-123';

describe('CapturingMailAdapter', () => {
  it('records rendered messages without sending anything', async () => {
    const mail = new CapturingMailAdapter();

    await mail.send({
      to: TO,
      template: 'email-verification',
      data: { verifyUrl: LINK, expiresInHours: 24 },
    });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: TO, template: 'email-verification' });
    expect(mail.sent[0]?.text).toContain(LINK);
  });

  it('exposes a read-only snapshot', async () => {
    const mail = new CapturingMailAdapter();
    await mail.send({
      to: TO,
      template: 'email-verification',
      data: { verifyUrl: LINK, expiresInHours: 24 },
    });

    const snapshot = mail.sent;
    mail.clear();

    expect(snapshot).toHaveLength(1);
    expect(mail.sent).toHaveLength(0);
  });

  it('returns the last message and the token sent to a recipient', async () => {
    const mail = new CapturingMailAdapter();
    await mail.send({
      to: TO,
      template: 'email-verification',
      data: { verifyUrl: LINK, expiresInHours: 24 },
    });
    await mail.send({
      to: 'autre@example.test',
      template: 'email-change-conflict',
      data: { resetUrl: LINK },
    });

    expect(mail.lastTo(TO)?.template).toBe('email-verification');
    expect(mail.lastTokenFor(TO)).toBe('tok_EN-123');
    expect(mail.lastTo('personne@example.test')).toBeUndefined();
    expect(mail.lastTokenFor('personne@example.test')).toBeUndefined();
  });

  it('refuses a recipient containing a line break (header injection)', async () => {
    const mail = new CapturingMailAdapter();

    await expect(
      mail.send({
        to: `${TO}\r\nBcc: victime@example.test`,
        template: 'email-change-conflict',
        data: { resetUrl: LINK },
      }),
    ).rejects.toBeInstanceOf(MailDeliveryError);
    expect(mail.sent).toHaveLength(0);
  });
});

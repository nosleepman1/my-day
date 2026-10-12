import { describe, expect, it } from 'vitest';

import type { MailTemplate, MailTemplateData } from './mail.port';
import { renderMail } from './render-mail';

const OCCURRED_AT = new Date('2026-10-12T09:30:00Z');
const LINK = 'https://orbit.example.com/verify-email#token=abc';

const SAMPLES: { [T in MailTemplate]: MailTemplateData[T] } = {
  'email-verification': { verifyUrl: LINK, expiresInHours: 24 },
  'registration-attempt': {
    loginUrl: 'https://orbit.example.com/login',
    resetUrl: 'https://orbit.example.com/forgot-password',
  },
  'password-reset': { resetUrl: LINK, expiresInMinutes: 30 },
  'password-changed': { occurredAt: OCCURRED_AT, timeZone: 'Africa/Dakar' },
  'new-login': {
    occurredAt: OCCURRED_AT,
    timeZone: 'Africa/Dakar',
    ipPrefix: '196.207.0.0/16',
    userAgent: 'Firefox',
  },
  'login-locked': {
    occurredAt: OCCURRED_AT,
    timeZone: 'Africa/Dakar',
    resetUrl: 'https://orbit.example.com/forgot-password',
  },
  'email-change-verification': { confirmUrl: LINK, expiresInHours: 24 },
  'email-change-notice': { occurredAt: OCCURRED_AT, timeZone: 'Africa/Dakar', ipPrefix: null },
  'email-change-conflict': { resetUrl: 'https://orbit.example.com/forgot-password' },
};

const TEMPLATES = Object.keys(SAMPLES) as MailTemplate[];

function render(template: MailTemplate): ReturnType<typeof renderMail> {
  return renderMail(template, SAMPLES[template]);
}

describe('renderMail', () => {
  it.each(TEMPLATES)('renders %s as French text and HTML with a single-line subject', (template) => {
    const mail = render(template);

    expect(mail.subject).toMatch(/^ORBIT · \S/);
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.text.length).toBeGreaterThan(50);
    expect(mail.html).toContain('<html lang="fr">');
  });

  it('gives every template its own subject', () => {
    const subjects = new Set(TEMPLATES.map((template) => render(template).subject));

    expect(subjects.size).toBe(TEMPLATES.length);
  });

  it('includes the action link in both text and HTML', () => {
    const mail = renderMail('email-verification', SAMPLES['email-verification']);

    expect(mail.text).toContain(LINK);
    expect(mail.html).toContain(`href="${LINK}"`);
    expect(mail.text).toContain('24 heures');
  });

  it('states the reset link lifetime in minutes', () => {
    expect(render('password-reset').text).toContain('30 minutes');
  });

  it("formats dates in the user's time zone", () => {
    const dakar = renderMail('password-changed', { occurredAt: OCCURRED_AT, timeZone: 'Africa/Dakar' });
    const paris = renderMail('password-changed', { occurredAt: OCCURRED_AT, timeZone: 'Europe/Paris' });

    expect(dakar.text).toContain('12 octobre 2026');
    expect(dakar.text).toContain('09:30');
    expect(paris.text).toContain('11:30');
  });

  it('escapes untrusted values in HTML (no stored XSS through the user agent)', () => {
    const mail = renderMail('new-login', {
      ...SAMPLES['new-login'],
      userAgent: '<script>alert("x")</script>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(mail.text).toContain('<script>alert("x")</script>');
  });

  it('truncates very long user agents', () => {
    const mail = renderMail('new-login', { ...SAMPLES['new-login'], userAgent: 'A'.repeat(1_000) });

    expect(mail.text).not.toContain('A'.repeat(201));
  });

  it('describes unknown IP and device instead of printing null', () => {
    const mail = renderMail('new-login', { ...SAMPLES['new-login'], ipPrefix: null, userAgent: null });

    expect(mail.text).toContain('adresse IP inconnue');
    expect(mail.text).toContain('appareil inconnu');
    expect(mail.text).not.toContain('null');
  });

  it('refuses a non-http(s) action link', () => {
    expect(() =>
      renderMail('email-verification', { verifyUrl: 'javascript:alert(1)', expiresInHours: 24 }),
    ).toThrow(/http/);
  });
});

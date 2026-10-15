import { createTransport } from 'nodemailer';

import { assertSafeRecipient, MailDeliveryError } from './mail-delivery.error';
import type { MailPort, MailRequest, MailTemplate } from './mail.port';
import { renderMail } from './render-mail';

/** L'envoi est synchrone en PHASE-01 : un serveur SMTP muet ne doit pas bloquer une requête HTTP. */
const CONNECTION_TIMEOUT_MS = 5_000;
const GREETING_TIMEOUT_MS = 5_000;
const SOCKET_TIMEOUT_MS = 10_000;

export type OutgoingMail = Readonly<{
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}>;

/** Partie du transport nodemailer utilisée par l'adaptateur ; remplaçable dans les tests. */
export interface SmtpSender {
  sendMail(mail: OutgoingMail): Promise<unknown>;
}

export type SmtpSecurity = 'none' | 'starttls' | 'tls';

export type SmtpOptions = Readonly<{
  security?: SmtpSecurity;
  user?: string | undefined;
  password?: string | undefined;
}>;

/**
 * Transport SMTP : Mailpit en local et en test (`none`), relais du fournisseur transactionnel en
 * déploiement (`starttls` sur 587 ou `tls` sur 465, ADR-042). En `starttls`, la montée en TLS est
 * exigée : un serveur qui ne la propose pas est refusé plutôt que contourné en clair.
 */
export function createSmtpTransport(host: string, port: number, options: SmtpOptions = {}): SmtpSender {
  const security = options.security ?? 'none';
  return createTransport({
    host,
    port,
    secure: security === 'tls',
    requireTLS: security === 'starttls',
    ...(security === 'none' ? {} : { tls: { minVersion: 'TLSv1.2' } }),
    ...(options.user === undefined || options.password === undefined
      ? {}
      : { auth: { user: options.user, pass: options.password } }),
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
}

/** Staging : une adresse est autorisée si elle figure telle quelle ou si son domaine (`@domaine`) y figure. */
export function isAllowlisted(recipient: string, allowlist: readonly string[]): boolean {
  const address = recipient.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf('@'));
  return allowlist.includes(address) || allowlist.includes(domain);
}

/**
 * Décorateur du port `MAIL` pour le staging : tout destinataire hors liste blanche est refusé
 * (`MailDeliveryError`, journalisé sans l'adresse par l'expéditeur), jamais envoyé.
 */
export class AllowlistMailAdapter implements MailPort {
  constructor(
    private readonly inner: MailPort,
    private readonly allowlist: readonly string[],
  ) {}

  async send<T extends MailTemplate>(request: MailRequest<T>): Promise<void> {
    if (!isAllowlisted(request.to, this.allowlist)) {
      throw new MailDeliveryError(request.template, { cause: new Error('recipient not allowlisted') });
    }
    await this.inner.send(request);
  }
}

/** Adaptateur SMTP du port `MAIL` : seul fichier autorisé à importer nodemailer (DESIGN_PATTERNS.md §2). */
export class SmtpMailAdapter implements MailPort {
  constructor(
    private readonly sender: SmtpSender,
    private readonly from: string,
  ) {}

  async send<T extends MailTemplate>(request: MailRequest<T>): Promise<void> {
    assertSafeRecipient(request.to, request.template);
    const { subject, text, html } = renderMail(request.template, request.data);
    try {
      await this.sender.sendMail({ from: this.from, to: request.to, subject, text, html });
    } catch (error: unknown) {
      throw new MailDeliveryError(request.template, { cause: error });
    }
  }
}

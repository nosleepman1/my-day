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

/** Transport SMTP (Mailpit en local et en test). Le fournisseur de production arrive en PHASE-03. */
export function createSmtpTransport(host: string, port: number): SmtpSender {
  return createTransport({
    host,
    port,
    secure: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
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

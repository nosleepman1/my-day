/** Jeton d'injection du port d'envoi d'e-mails (DESIGN_PATTERNS.md §2). */
export const MAIL = Symbol('MAIL');

/** Instant d'un événement, affiché dans le fuseau de l'utilisateur (`user_preferences.timezone`). */
interface EventMoment {
  occurredAt: Date;
  timeZone: string;
}

/** Données de chaque gabarit. Les liens sont construits par l'appelant (`buildTokenLink`). */
export interface MailTemplateData {
  'email-verification': { verifyUrl: string; expiresInHours: number };
  /** Inscription tentée avec une adresse déjà inscrite (SECURITY.md §3.4, réponse indistinguable). */
  'registration-attempt': { loginUrl: string; resetUrl: string };
  'password-reset': { resetUrl: string; expiresInMinutes: number };
  'password-changed': EventMoment;
  'new-login': EventMoment & { ipPrefix: string | null; userAgent: string | null };
  'login-locked': EventMoment & { resetUrl: string };
  /** Envoyé à la nouvelle adresse (SECURITY.md §3.6). */
  'email-change-verification': { confirmUrl: string; expiresInHours: number };
  /** Envoyé à l'ancienne adresse, avec la date et l'IP tronquée. */
  'email-change-notice': EventMoment & { ipPrefix: string | null };
  /** Envoyé à une adresse déjà utilisée par un autre compte : rien n'est modifié. */
  'email-change-conflict': { resetUrl: string };
}

export type MailTemplate = keyof MailTemplateData;

export type MailRequest<T extends MailTemplate = MailTemplate> = Readonly<{
  to: string;
  template: T;
  data: Readonly<MailTemplateData[T]>;
}>;

export type RenderedMail = Readonly<{ subject: string; text: string; html: string }>;

/**
 * Envoi d'e-mails transactionnels. En PHASE-01, l'envoi est synchrone (SMTP, Mailpit en local) ;
 * il passera par la file de tâches en PHASE-08. Lève `MailDeliveryError` en cas d'échec.
 */
export interface MailPort {
  send<T extends MailTemplate>(request: MailRequest<T>): Promise<void>;
}

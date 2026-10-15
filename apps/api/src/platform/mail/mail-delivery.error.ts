import type { MailTemplate } from './mail.port';

/**
 * Échec d'envoi d'un e-mail. Le message ne contient jamais l'adresse du destinataire (donnée personnelle) ;
 * la cause technique reste disponible dans `cause` pour les journaux serveur, qui la caviardent.
 */
export class MailDeliveryError extends Error {
  override readonly name = 'MailDeliveryError';

  constructor(
    readonly template: MailTemplate,
    options?: ErrorOptions,
  ) {
    super(`Mail delivery failed (template ${template})`, options);
  }
}

/** Un retour à la ligne dans l'adresse permettrait d'injecter des en-têtes (`Bcc:`…). */
export function assertSafeRecipient(to: string, template: MailTemplate): void {
  // Un seul destinataire : ni saut de ligne (injection d'en-tête) ni liste `a@x, b@y` (revue PHASE-03).
  if (/[\r\n,;]/.test(to)) throw new MailDeliveryError(template);
}

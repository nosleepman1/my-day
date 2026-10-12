import { assertHttpUrl, describeDevice, describeIp, formatMoment } from './mail-format';
import type { MailTemplate, MailTemplateData } from './mail.port';

/** Contenu structuré d'un e-mail, en texte brut : le rendu HTML l'échappe intégralement. */
export interface MailContent {
  subject: string;
  paragraphs: readonly string[];
  action?: Readonly<{ label: string; url: string }>;
  closing: string;
}

type TemplateBuilders = { [T in MailTemplate]: (data: Readonly<MailTemplateData[T]>) => MailContent };

const subject = (title: string): string => `ORBIT · ${title}`;

/** Gabarits en français (PHASE-01) ; le vouvoiement est la règle de toute l'interface. */
export const MAIL_TEMPLATES: TemplateBuilders = {
  'email-verification': ({ verifyUrl, expiresInHours }) => ({
    subject: subject('Confirmez votre adresse e-mail'),
    paragraphs: [
      'Bienvenue sur ORBIT.',
      `Pour activer votre compte, confirmez votre adresse e-mail. Ce lien est valable ${expiresInHours} heures et ne peut servir qu'une seule fois.`,
    ],
    action: { label: 'Confirmer mon adresse', url: assertHttpUrl(verifyUrl) },
    closing: "Si vous n'avez pas créé de compte ORBIT, ignorez cet e-mail : aucun compte ne sera activé.",
  }),
  'registration-attempt': ({ loginUrl, resetUrl }) => ({
    subject: subject("Tentative d'inscription avec votre adresse"),
    paragraphs: [
      "Quelqu'un a tenté de créer un compte ORBIT avec votre adresse e-mail. Votre compte existe déjà et n'a pas été modifié.",
      `Mot de passe oublié ? Vous pouvez le réinitialiser ici : ${assertHttpUrl(resetUrl)}`,
    ],
    action: { label: 'Me connecter', url: assertHttpUrl(loginUrl) },
    closing: "Si vous n'êtes pas à l'origine de cette tentative, vous pouvez ignorer cet e-mail.",
  }),
  'password-reset': ({ resetUrl, expiresInMinutes }) => ({
    subject: subject('Réinitialisation de votre mot de passe'),
    paragraphs: [
      'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte.',
      `Ce lien est valable ${expiresInMinutes} minutes et ne peut servir qu'une seule fois. Après le changement, toutes vos sessions seront fermées.`,
    ],
    action: { label: 'Choisir un nouveau mot de passe', url: assertHttpUrl(resetUrl) },
    closing:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
  }),
  'password-changed': ({ occurredAt, timeZone }) => ({
    subject: subject('Votre mot de passe a été modifié'),
    paragraphs: [
      `Le mot de passe de votre compte a été modifié le ${formatMoment(occurredAt, timeZone)}.`,
      'Vos autres sessions ont été fermées.',
    ],
    closing:
      "Si vous n'êtes pas à l'origine de ce changement, réinitialisez immédiatement votre mot de passe depuis la page de connexion.",
  }),
  'new-login': ({ occurredAt, timeZone, ipPrefix, userAgent }) => ({
    subject: subject('Nouvelle connexion à votre compte'),
    paragraphs: [
      `Une connexion à votre compte a eu lieu le ${formatMoment(occurredAt, timeZone)}.`,
      `Appareil : ${describeDevice(userAgent)}`,
      `Adresse IP : ${describeIp(ipPrefix)}`,
    ],
    closing:
      "Si ce n'était pas vous, changez votre mot de passe et fermez les autres sessions depuis vos paramètres.",
  }),
  'login-locked': ({ occurredAt, timeZone, resetUrl }) => ({
    subject: subject('Connexion temporairement bloquée'),
    paragraphs: [
      `Après plusieurs tentatives de connexion échouées, l'accès à votre compte a été bloqué temporairement le ${formatMoment(occurredAt, timeZone)}.`,
      'Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser.',
    ],
    action: { label: 'Réinitialiser mon mot de passe', url: assertHttpUrl(resetUrl) },
    closing:
      "Si ces tentatives ne viennent pas de vous, quelqu'un essaie peut-être de deviner votre mot de passe : choisissez-en un long et unique.",
  }),
  'email-change-verification': ({ confirmUrl, expiresInHours }) => ({
    subject: subject('Confirmez votre nouvelle adresse e-mail'),
    paragraphs: [
      'Une demande de changement de votre adresse e-mail ORBIT vers celle-ci a été faite.',
      `Ce lien est valable ${expiresInHours} heures et ne peut servir qu'une seule fois.`,
    ],
    action: { label: 'Confirmer cette adresse', url: assertHttpUrl(confirmUrl) },
    closing: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  }),
  'email-change-notice': ({ occurredAt, timeZone, ipPrefix }) => ({
    subject: subject("Changement d'adresse e-mail demandé"),
    paragraphs: [
      `Le ${formatMoment(occurredAt, timeZone)}, un changement de l'adresse e-mail de votre compte a été demandé (adresse IP : ${describeIp(ipPrefix)}).`,
      "Le changement ne prendra effet qu'après confirmation depuis la nouvelle adresse.",
    ],
    closing: "Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe sans attendre.",
  }),
  'email-change-conflict': ({ resetUrl }) => ({
    subject: subject('Votre adresse a été proposée pour un autre compte'),
    paragraphs: [
      "Quelqu'un a demandé à associer votre adresse e-mail à un autre compte ORBIT. Comme elle est déjà utilisée par votre compte, rien n'a été modifié.",
      'Mot de passe oublié ? Vous pouvez le réinitialiser.',
    ],
    action: { label: 'Réinitialiser mon mot de passe', url: assertHttpUrl(resetUrl) },
    closing: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
  }),
};

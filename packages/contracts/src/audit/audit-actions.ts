/**
 * Catalogue des actions auditées (`audit_logs.action`, DATA_MODEL.md) : `<module>.<entité>.<verbe>`.
 * Ajouter une action = l'ajouter ici ; une valeur publiée n'est jamais renommée.
 */
export const AUDIT_ACTIONS = [
  'auth.register',
  'auth.email.verify',
  'auth.email.verify_resend',
  'auth.login',
  'auth.logout',
  'auth.reauth',
  'auth.password.forgot',
  'auth.password.reset',
  'auth.password.change',
  'auth.email.change_request',
  'auth.email.change_confirm',
  'auth.session.revoke',
  'auth.session.revoke_others',
  'users.profile.update',
  'users.preferences.update',
  'authz.cross_user_attempt',
  'authz.role_denied',
  'organization.idea.convert',
  'organization.task.status_change',
  'organization.task.due_change',
  'organization.tag.merge',
  'finance.account.create',
  'finance.account.update',
  'finance.account.close',
  'finance.account.reopen',
  'finance.transaction.create',
  'finance.transaction.update',
  'finance.transaction.validate',
  'finance.transaction.cancel',
  'finance.transaction.delete',
  'finance.adjustment.create',
  'finance.transfer.create',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

import { COMMON_PASSWORDS } from './common-passwords';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
/** Une partie locale plus courte (« a@… ») rendrait la règle « contient l'e-mail » absurde. */
const MIN_EMAIL_LOCAL_PART_TO_CHECK = 3;

export type PasswordViolation = 'TOO_SHORT' | 'TOO_LONG' | 'COMMON' | 'CONTAINS_EMAIL';

function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Politique de mot de passe (SECURITY.md §3.3) : 12 à 128 caractères en points de code après NFC,
 * tout caractère Unicode accepté, aucune règle de composition ; refus des mots de passe courants
 * et de ceux qui contiennent la partie locale de l'e-mail. Renvoie la liste des violations (vide = valide).
 */
export function checkPasswordPolicy(password: string, email: string): PasswordViolation[] {
  const normalized = password.normalize('NFC');
  const length = codePointLength(normalized);
  const lowered = normalized.toLowerCase();
  const localPart = (email.split('@')[0] ?? '').toLowerCase();

  const violations: PasswordViolation[] = [];
  if (length < MIN_PASSWORD_LENGTH) violations.push('TOO_SHORT');
  if (length > MAX_PASSWORD_LENGTH) violations.push('TOO_LONG');
  if (COMMON_PASSWORDS.has(lowered)) violations.push('COMMON');
  if (localPart.length >= MIN_EMAIL_LOCAL_PART_TO_CHECK && lowered.includes(localPart)) {
    violations.push('CONTAINS_EMAIL');
  }
  return violations;
}

/**
 * Chemins masqués dans tous les logs (CODING_STANDARDS §7). Filet de sécurité : un objet métier complet
 * ne se passe jamais au logger, et les corps de requête et de réponse ne sont pas journalisés.
 */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.secret',
  '*.totpCode',
  '*.recoveryCode',
  '*.ciphertext',
  '*.dek',
  '*.kek',
  '*.email',
  '*.phone',
] as const;

export const REDACT_CENSOR = '[REDACTED]';

import { isIP } from 'node:net';

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Origine d'une requête, pour `login_events` et les e-mails de sécurité. */
export type ClientContext = Readonly<{ ip: string | null; userAgent: string | null }>;

export type ClientRequestLike = Readonly<{
  /** Résolue par Express selon `trust proxy` (`TRUST_PROXY_HOPS`) : jamais lue dans un en-tête brut. */
  ip?: string | undefined;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}>;

/** `login_events.user_agent_label` est un varchar(200). */
const MAX_USER_AGENT_LENGTH = 200;
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

function isPrintable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= FIRST_PRINTABLE && code !== DELETE;
}

function userAgentLabel(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const label = Array.from(raw).filter(isPrintable).join('').trim().slice(0, MAX_USER_AGENT_LENGTH);
  return label === '' ? null : label;
}

export function clientContextFrom(request: ClientRequestLike): ClientContext {
  const ip = request.ip !== undefined && isIP(request.ip) !== 0 ? request.ip : null;
  return { ip, userAgent: userAgentLabel(request.headers['user-agent']) };
}

/** Paramètre de contrôleur : `@CurrentClient() client: ClientContext`. */
export const CurrentClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientContext =>
    clientContextFrom(context.switchToHttp().getRequest<ClientRequestLike>()),
);

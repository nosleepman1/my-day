import { assertSafeRecipient } from './mail-delivery.error';
import type { MailPort, MailRequest, MailTemplate, RenderedMail } from './mail.port';
import { renderMail } from './render-mail';

export type CapturedMail = RenderedMail & Readonly<{ to: string; template: MailTemplate }>;

const TOKEN_IN_LINK = /#token=([A-Za-z0-9_-]+)/;

/**
 * Adaptateur de test du port `MAIL` (DESIGN_PATTERNS.md §2) : rend les gabarits comme en production,
 * mais conserve les messages en mémoire au lieu de les envoyer.
 */
export class CapturingMailAdapter implements MailPort {
  private messages: readonly CapturedMail[] = [];

  get sent(): readonly CapturedMail[] {
    return this.messages;
  }

  send<T extends MailTemplate>(request: MailRequest<T>): Promise<void> {
    try {
      assertSafeRecipient(request.to, request.template);
      const rendered = renderMail(request.template, request.data);
      this.messages = [...this.messages, { ...rendered, to: request.to, template: request.template }];
      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  lastTo(to: string): CapturedMail | undefined {
    return this.messages.filter((message) => message.to === to).at(-1);
  }

  /** Jeton du dernier lien envoyé à cette adresse, pour enchaîner les parcours dans les tests. */
  lastTokenFor(to: string): string | undefined {
    const message = this.lastTo(to);
    return message === undefined ? undefined : TOKEN_IN_LINK.exec(message.text)?.[1];
  }

  clear(): void {
    this.messages = [];
  }
}

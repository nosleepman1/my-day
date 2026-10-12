import { escapeHtml } from './mail-format';
import { MAIL_TEMPLATES, type MailContent } from './mail-templates';
import type { MailTemplate, MailTemplateData, RenderedMail } from './mail.port';

const SIGNATURE = "— L'équipe ORBIT";

function renderText(content: MailContent): string {
  const action = content.action ? [`${content.action.label} :\n${content.action.url}`] : [];
  return [...content.paragraphs, ...action, content.closing, SIGNATURE].join('\n\n');
}

function renderHtml(content: MailContent): string {
  const paragraphs = content.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
  const action = content.action
    ? `<p><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:10px 18px;background:#1f2937;color:#ffffff;border-radius:6px;text-decoration:none">${escapeHtml(content.action.label)}</a></p>`
    : '';
  return [
    '<!doctype html>',
    '<html lang="fr">',
    `<head><meta charset="utf-8"><title>${escapeHtml(content.subject)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">',
    paragraphs,
    action,
    `<p style="color:#6b7280;font-size:13px">${escapeHtml(content.closing)}</p>`,
    `<p style="color:#6b7280;font-size:13px">${escapeHtml(SIGNATURE)}</p>`,
    '</div>',
    '</body>',
    '</html>',
  ].join('\n');
}

/** Rend un gabarit en texte brut et en HTML échappé ; lève si un lien n'est pas http(s). */
export function renderMail<T extends MailTemplate>(
  template: T,
  data: Readonly<MailTemplateData[T]>,
): RenderedMail {
  const build = MAIL_TEMPLATES[template] as (input: Readonly<MailTemplateData[T]>) => MailContent;
  const content = build(data);
  return { subject: content.subject, text: renderText(content), html: renderHtml(content) };
}

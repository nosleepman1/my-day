/**
 * Analyse Markdown minimale (SECURITY.md, contenu non fiable) : produit un arbre de données, jamais du
 * HTML. Le rendu React échappe tout le texte ; seuls les liens `http(s):` et `mailto:` deviennent cliquables.
 * Pris en charge : titres, paragraphes, listes (puces, numérotées, cases à cocher), citations, blocs de
 * code, et en ligne : `code`, **gras**, *italique*, [liens](https://…) et adresses http(s) nues.
 */

export type Inline =
  | Readonly<{ type: 'text'; value: string }>
  | Readonly<{ type: 'code'; value: string }>
  | Readonly<{ type: 'strong' | 'em'; children: readonly Inline[] }>
  | Readonly<{ type: 'link'; href: string; children: readonly Inline[] }>;

export type Block =
  | Readonly<{ type: 'heading'; level: number; inline: readonly Inline[] }>
  | Readonly<{ type: 'paragraph' | 'quote'; inline: readonly Inline[] }>
  | Readonly<{ type: 'list'; ordered: boolean; items: readonly (readonly Inline[])[] }>
  | Readonly<{
      type: 'checklist';
      items: readonly Readonly<{ checked: boolean; inline: readonly Inline[] }>[];
    }>
  | Readonly<{ type: 'code'; value: string }>;

const SAFE_URL = /^(https?:\/\/|mailto:)[^\s]+$/i;
/**
 * Quantificateurs bornés : un `[`, `*` ou `_` jamais fermé ne déclenche qu'un balayage court, sinon une
 * note de 200 000 caractères piégée coûterait O(n²) à chaque rendu (revue sécurité PHASE-04, M2).
 */
const INLINE =
  /(`[^`\n]{1,500}`)|(\*\*[^*\n]{1,500}\*\*)|(\*[^*\n]{1,500}\*|_[^_\n]{1,500}_)|(\[[^\]\n]{1,200}\]\([^)\s]{1,2048}\))|(https?:\/\/[^\s<>)"']{1,2048})/g;

/** Lien accepté seulement s'il est absolu en http(s) ou mailto : jamais `javascript:` ni `data:`. */
export function safeHref(url: string): string | null {
  return SAFE_URL.test(url.trim()) ? url.trim() : null;
}

function linkToken(raw: string): Inline {
  const match = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(raw);
  const label = match?.[1] ?? raw;
  const href = safeHref(match?.[2] ?? '');
  return href === null
    ? { type: 'text', value: label }
    : { type: 'link', href, children: parseInline(label, false) };
}

function token(raw: string, allowLinks: boolean): Inline {
  if (raw.startsWith('`')) return { type: 'code', value: raw.slice(1, -1) };
  if (raw.startsWith('**')) return { type: 'strong', children: parseInline(raw.slice(2, -2), allowLinks) };
  if (raw.startsWith('*') || raw.startsWith('_'))
    return { type: 'em', children: parseInline(raw.slice(1, -1), allowLinks) };
  // Dans le libellé d'un lien, aucun lien imbriqué (pas de <a> dans un <a>).
  if (!allowLinks) return { type: 'text', value: raw };
  if (raw.startsWith('[')) return linkToken(raw);
  const href = safeHref(raw);
  return href === null
    ? { type: 'text', value: raw }
    : { type: 'link', href, children: [{ type: 'text', value: raw }] };
}

export function parseInline(text: string, allowLinks = true): Inline[] {
  const result: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index;
    if (index > last) result.push({ type: 'text', value: text.slice(last, index) });
    result.push(token(match[0], allowLinks));
    last = index + match[0].length;
  }
  if (last < text.length) result.push({ type: 'text', value: text.slice(last) });
  return result;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const CHECK_ITEM = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```/;

/** Position de lecture dans les lignes du document. */
class Cursor {
  index = 0;

  advance(): void {
    this.index += 1;
  }
}

/** Lignes consécutives qui correspondent à `pattern`, avec leur premier groupe capturé. */
function takeWhile(lines: readonly string[], cursor: Cursor, pattern: RegExp): RegExpExecArray[] {
  const taken: RegExpExecArray[] = [];
  for (let match = pattern.exec(lines[cursor.index] ?? ''); match !== null;) {
    taken.push(match);
    cursor.advance();
    match = cursor.index < lines.length ? pattern.exec(lines[cursor.index] ?? '') : null;
  }
  return taken;
}

function codeBlock(lines: readonly string[], cursor: Cursor): Block {
  cursor.advance();
  const body: string[] = [];
  while (cursor.index < lines.length && !(lines[cursor.index] ?? '').startsWith('```')) {
    body.push(lines[cursor.index] ?? '');
    cursor.advance();
  }
  cursor.advance();
  return { type: 'code', value: body.join('\n') };
}

function listBlock(lines: readonly string[], cursor: Cursor, line: string): Block | null {
  if (CHECK_ITEM.test(line)) {
    const items = takeWhile(lines, cursor, CHECK_ITEM).map((match) => ({
      checked: match[1] !== ' ',
      inline: parseInline(match[2] ?? ''),
    }));
    return { type: 'checklist', items };
  }
  if (BULLET_ITEM.test(line) || ORDERED_ITEM.test(line)) {
    const ordered = ORDERED_ITEM.test(line);
    const items = takeWhile(lines, cursor, ordered ? ORDERED_ITEM : BULLET_ITEM).map((match) =>
      parseInline(match[1] ?? ''),
    );
    return { type: 'list', ordered, items };
  }
  return null;
}

function isBlockStart(line: string): boolean {
  return [HEADING, BULLET_ITEM, ORDERED_ITEM, QUOTE, FENCE].some((pattern) => pattern.test(line));
}

function paragraph(lines: readonly string[], cursor: Cursor): Block {
  const text: string[] = [];
  while (cursor.index < lines.length) {
    const line = lines[cursor.index] ?? '';
    if (line.trim() === '' || (text.length > 0 && isBlockStart(line))) break;
    text.push(line.trim());
    cursor.advance();
  }
  return { type: 'paragraph', inline: parseInline(text.join(' ')) };
}

function nextBlock(lines: readonly string[], cursor: Cursor): Block | null {
  const line = lines[cursor.index] ?? '';
  if (line.trim() === '') {
    cursor.advance();
    return null;
  }
  if (line.startsWith('```')) return codeBlock(lines, cursor);
  const heading = HEADING.exec(line);
  if (heading !== null) {
    cursor.advance();
    return { type: 'heading', level: heading[1]?.length ?? 1, inline: parseInline(heading[2] ?? '') };
  }
  if (QUOTE.test(line)) {
    const quoted = takeWhile(lines, cursor, QUOTE).map((match) => match[1] ?? '');
    return { type: 'quote', inline: parseInline(quoted.join(' ')) };
  }
  return listBlock(lines, cursor, line) ?? paragraph(lines, cursor);
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const cursor = new Cursor();
  const blocks: Block[] = [];
  while (cursor.index < lines.length) {
    const block = nextBlock(lines, cursor);
    if (block !== null) blocks.push(block);
  }
  return blocks;
}

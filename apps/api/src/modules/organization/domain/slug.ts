const SLUG_MAX = 80;
const FALLBACK_SLUG = 'projet';

function trimDashes(value: string): string {
  return value.replace(/^-+/, '').replace(/-+$/, '');
}

/** Slug d'un nom de projet : sans accents, minuscules, chiffres et tirets simples (`ck_projects__slug_format`). */
export function slugify(name: string): string {
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const slug = trimDashes(trimDashes(ascii.replace(/[^a-z0-9]+/g, '-')).slice(0, SLUG_MAX));
  return slug === '' ? FALLBACK_SLUG : slug;
}

/** Premier slug libre parmi `base`, `base-2`, `base-3`… (unicité parmi les projets vivants). */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${trimDashes(base.slice(0, SLUG_MAX - tail.length))}${tail}`;
    if (!taken.has(candidate)) return candidate;
  }
}

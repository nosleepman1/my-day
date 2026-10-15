import { z } from 'zod';

import { PaginationQuerySchema } from '../common/pagination';

/** Briques communes aux ressources M03 (idées, projets, tâches, notes, tags). */

export const PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const PrioritySchema = z.enum(PRIORITY_LEVELS);
export type Priority = z.infer<typeof PrioritySchema>;

export const CAPTURE_SOURCES = [
  'MANUAL',
  'QUICK_CAPTURE',
  'EMAIL',
  'WHATSAPP',
  'VOICE',
  'IMPORT',
  'AI',
  'AUTOMATION',
  'RECURRENCE',
] as const;
export const CaptureSourceSchema = z.enum(CAPTURE_SOURCES);
export type CaptureSource = z.infer<typeof CaptureSourceSchema>;

/** Sources qu'un client peut déclarer en PHASE-04 ; les autres sont produites par le serveur. */
export const ClientCaptureSourceSchema = z.enum(['MANUAL', 'QUICK_CAPTURE']);

/** `:id` de route : UUID quelconque (un identifiant non UUID donne 400, API.md §1). */
export const IdParamSchema = z.object({ id: z.uuid() }).strict();
export type IdParam = z.infer<typeof IdParamSchema>;

export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur au format #RRGGBB.');

export const MAX_TAGS_PER_ITEM = 20;
export const TagIdsSchema = z
  .array(z.uuid())
  .max(MAX_TAGS_PER_ITEM)
  .refine((ids) => new Set(ids).size === ids.length, 'Tags en double.');

/** `PUT /<ressource>/:id/tags` : remplace l'ensemble des tags. */
export const SetTagsRequestSchema = z.object({ tagIds: TagIdsSchema }).strict();
export type SetTagsRequest = z.infer<typeof SetTagsRequestSchema>;

/** Texte saisi : espaces de bord retirés, forme NFC (API.md §6.3). */
export function text(min: number, max: number) {
  return z.string().trim().normalize('NFC').min(min).max(max);
}

/** Texte facultatif : `null` efface, une chaîne vide aussi. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .normalize('NFC')
    .max(max)
    .nullable()
    .transform((value) => (value === '' ? null : value));
}

/** Filtre `archived` des listes (API.md §1.8) : actifs par défaut. */
export const ArchivedFilterSchema = z.enum(['false', 'true', 'all']).default('false');
export type ArchivedFilter = z.infer<typeof ArchivedFilterSchema>;

export const QueryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Liste de valeurs d'énumération séparées par des virgules, 20 au plus (API.md §8). */
export function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((raw) => raw.split(','))
    .pipe(z.array(z.enum(values)).min(1).max(20));
}

/** Recherche textuelle de liste `q` (API.md §8). */
export const SearchQuerySchema = z.string().trim().min(2).max(200);

export const listQueryBase = PaginationQuerySchema.shape;

/** Lien court vers un élément d'organisation (détails, notes liées). */
export const ItemRefSchema = z.object({ id: z.uuid(), title: z.string() });
export type ItemRef = z.infer<typeof ItemRefSchema>;

import type { Response } from 'express';

const API_PREFIX = '/api/v1';

/**
 * Réponse d'une création idempotente : `201` + `Location` à la première écriture, `200` quand la file hors
 * ligne rejoue un élément déjà créé (API.md §1.6, ADR-016).
 */
export function respondCreation(response: Response, created: boolean, path: string): void {
  response.status(created ? 201 : 200);
  if (created) response.setHeader('Location', `${API_PREFIX}${path}`);
}

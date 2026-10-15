import { type INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../src/platform/auth/public.decorator';

const GLOBAL_PREFIX = '/api/v1';

export type RouteEntry = Readonly<{
  method: string;
  path: string;
  isPublic: boolean;
  /** Clé stable « MÉTHODE /api/v1/chemin », utilisée par la liste blanche et les exemptions. */
  key: string;
}>;

type ControllerClass = new (...args: never[]) => object;

function pathsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [typeof value === 'string' ? value : '/'];
}

function join(...segments: string[]): string {
  const joined = `/${segments.join('/')}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

/** Routes déclarées par un contrôleur : une entrée par (chemin de classe × chemin de méthode). */
function routesOf(controller: ControllerClass): RouteEntry[] {
  const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype).flatMap((name) => {
    const handler = prototype[name];
    if (typeof handler !== 'function') return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const verb = RequestMethod[method];
    const isPublic = classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
    return pathsOf(Reflect.getMetadata(PATH_METADATA, controller)).flatMap((base) =>
      pathsOf(Reflect.getMetadata(PATH_METADATA, handler)).map((sub) => {
        const path = join(GLOBAL_PREFIX, base, sub);
        return { method: verb, path, isPublic, key: `${verb} ${path}` };
      }),
    );
  });
}

/** Registre des routes HTTP lu dans les métadonnées NestJS de tous les contrôleurs chargés (T14). */
export function listRoutes(app: INestApplication): RouteEntry[] {
  const controllers = [...app.get(ModulesContainer).values()].flatMap((module) =>
    [...module.controllers.values()].map((wrapper) => wrapper.metatype as ControllerClass | null),
  );
  return controllers
    .flatMap((controller) => (controller === null ? [] : routesOf(controller)))
    .sort((a, b) => a.key.localeCompare(b.key));
}

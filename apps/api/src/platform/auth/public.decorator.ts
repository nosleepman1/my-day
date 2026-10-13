import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'orbit:isPublic';

/**
 * Route accessible sans session (SECURITY.md §3.1). Toute route publique doit figurer dans la liste blanche
 * d'API.md §14.1 ; le harnais de T14 vérifie la correspondance.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

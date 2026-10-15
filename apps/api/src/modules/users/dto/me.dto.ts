import { createZodDto } from 'nestjs-zod';

import {
  MeResponseSchema,
  PreferencesResponseSchema,
  UpdatePreferencesRequestSchema,
  UpdateProfileRequestSchema,
} from '@orbit/contracts';

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
export class UpdateProfileRequestDto extends createZodDto(UpdateProfileRequestSchema) {}
export class PreferencesResponseDto extends createZodDto(PreferencesResponseSchema) {}
export class UpdatePreferencesRequestDto extends createZodDto(UpdatePreferencesRequestSchema) {}

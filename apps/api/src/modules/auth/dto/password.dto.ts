import { createZodDto } from 'nestjs-zod';

import {
  ForgotPasswordRequestSchema,
  ReauthRequestSchema,
  ResetPasswordRequestSchema,
} from '@orbit/contracts';

export class ForgotPasswordRequestDto extends createZodDto(ForgotPasswordRequestSchema) {}
export class ResetPasswordRequestDto extends createZodDto(ResetPasswordRequestSchema) {}
export class ReauthRequestDto extends createZodDto(ReauthRequestSchema) {}

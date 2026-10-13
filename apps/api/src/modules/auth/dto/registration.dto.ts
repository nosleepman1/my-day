import { createZodDto } from 'nestjs-zod';

import {
  AcceptedResponseSchema,
  RegisterRequestSchema,
  ResendVerificationRequestSchema,
} from '@orbit/contracts';

export class RegisterRequestDto extends createZodDto(RegisterRequestSchema) {}
export class ResendVerificationRequestDto extends createZodDto(ResendVerificationRequestSchema) {}
export class AcceptedResponseDto extends createZodDto(AcceptedResponseSchema) {}

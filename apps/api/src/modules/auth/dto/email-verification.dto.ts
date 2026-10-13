import { createZodDto } from 'nestjs-zod';

import { EmailVerifiedResponseSchema, VerifyEmailRequestSchema } from '@orbit/contracts';

export class VerifyEmailRequestDto extends createZodDto(VerifyEmailRequestSchema) {}
export class EmailVerifiedResponseDto extends createZodDto(EmailVerifiedResponseSchema) {}

import { createZodDto } from 'nestjs-zod';

import { LoginRequestSchema, LoginResponseSchema } from '@orbit/contracts';

export class LoginRequestDto extends createZodDto(LoginRequestSchema) {}
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}

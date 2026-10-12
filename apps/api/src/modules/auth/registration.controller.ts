import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { AcceptedResponse } from '@orbit/contracts';

import {
  AcceptedResponseDto,
  RegisterRequestDto,
  ResendVerificationRequestDto,
} from './dto/registration.dto';
import { RegistrationService } from './registration.service';

const ACCEPTED: AcceptedResponse = { data: { status: 'accepted' } };

/**
 * Routes publiques d'inscription (API.md §14.3). `@Public` et la limitation de débit arrivent avec
 * le guard global de session (T6) et le throttling (T8).
 */
@Controller('auth')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(AcceptedResponseDto)
  async register(@Body() body: RegisterRequestDto): Promise<AcceptedResponse> {
    await this.registration.register(body);
    return ACCEPTED;
  }

  @Post('email/verify/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(AcceptedResponseDto)
  async resendVerification(@Body() body: ResendVerificationRequestDto): Promise<AcceptedResponse> {
    await this.registration.resendVerification(body);
    return ACCEPTED;
  }
}

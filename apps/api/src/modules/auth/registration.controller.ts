import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodSerializerDto } from 'nestjs-zod';

import type { AcceptedResponse } from '@orbit/contracts';

import { Audited } from '../../platform/audit/audit.interceptor';
import { Public } from '../../platform/auth/public.decorator';
import { AUTH_ROUTE_LIMITS } from '../../platform/http/rate-limit';

import {
  AcceptedResponseDto,
  RegisterRequestDto,
  ResendVerificationRequestDto,
} from './dto/registration.dto';
import { RegistrationService } from './registration.service';

const ACCEPTED: AcceptedResponse = { data: { status: 'accepted' } };

/**
 * Routes publiques d'inscription (API.md §14.3). La limitation de débit arrive en T8.
 */
@Public()
@Controller('auth')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @Audited('auth.register')
  @Throttle(AUTH_ROUTE_LIMITS.register)
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(AcceptedResponseDto)
  async register(@Body() body: RegisterRequestDto): Promise<AcceptedResponse> {
    await this.registration.register(body);
    return ACCEPTED;
  }

  @Post('email/verify/resend')
  @Audited('auth.email.verify_resend')
  @Throttle(AUTH_ROUTE_LIMITS.resendVerification)
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(AcceptedResponseDto)
  async resendVerification(@Body() body: ResendVerificationRequestDto): Promise<AcceptedResponse> {
    await this.registration.resendVerification(body);
    return ACCEPTED;
  }
}

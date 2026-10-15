import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodSerializerDto } from 'nestjs-zod';

import type { EmailVerifiedResponse } from '@orbit/contracts';

import { Audited } from '../../platform/audit/audit.interceptor';
import { Public } from '../../platform/auth/public.decorator';
import { type ClientContext, CurrentClient } from '../../platform/http/client-context';
import { AUTH_ROUTE_LIMITS } from '../../platform/http/rate-limit';

import { EmailVerifiedResponseDto, VerifyEmailRequestDto } from './dto/email-verification.dto';
import { EmailConfirmationService } from './email-confirmation.service';

const VERIFIED: EmailVerifiedResponse = { data: { status: 'verified' } };

/** Route publique de vérification d'adresse (API.md §14.3). La limitation de débit arrive en T8. */
@Public()
@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly confirmation: EmailConfirmationService) {}

  @Post('verify')
  @Audited('auth.email.verify')
  @Throttle(AUTH_ROUTE_LIMITS.verifyEmail)
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EmailVerifiedResponseDto)
  async verify(
    @Body() body: VerifyEmailRequestDto,
    @CurrentClient() client: ClientContext,
  ): Promise<EmailVerifiedResponse> {
    await this.confirmation.verify(body.token, client);
    return VERIFIED;
  }
}

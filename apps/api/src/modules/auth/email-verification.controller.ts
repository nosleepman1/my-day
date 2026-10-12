import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { EmailVerifiedResponse } from '@orbit/contracts';

import { type ClientContext, CurrentClient } from '../../platform/http/client-context';

import { EmailVerifiedResponseDto, VerifyEmailRequestDto } from './dto/email-verification.dto';
import { EmailConfirmationService } from './email-confirmation.service';

const VERIFIED: EmailVerifiedResponse = { data: { status: 'verified' } };

/** Route publique de vérification d'adresse (API.md §14.3) ; `@Public` arrive avec le guard global (T6). */
@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly confirmation: EmailConfirmationService) {}

  @Post('verify')
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

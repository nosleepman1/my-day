import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { AcceptedResponse } from '@orbit/contracts';

import { Public } from '../../platform/auth/public.decorator';

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

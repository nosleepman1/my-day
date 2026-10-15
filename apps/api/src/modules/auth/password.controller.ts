import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';

import type { AcceptedResponse } from '@orbit/contracts';

import { Audited } from '../../platform/audit/audit.interceptor';
import { Public } from '../../platform/auth/public.decorator';
import { CurrentSession } from '../../platform/auth/session-context';
import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import { clientContextFrom } from '../../platform/http/client-context';
import { AUTH_ROUTE_LIMITS } from '../../platform/http/rate-limit';

import { ForgotPasswordRequestDto, ReauthRequestDto, ResetPasswordRequestDto } from './dto/password.dto';
import { AcceptedResponseDto } from './dto/registration.dto';
import { PasswordResetRequestService } from './password-reset-request.service';
import { PasswordResetService } from './password-reset.service';
import { ReauthService } from './reauth.service';

const ACCEPTED: AcceptedResponse = { data: { status: 'accepted' } };

/** Mot de passe oublié, réinitialisation et ré-authentification (API.md §14.3, SECURITY.md §3.5, §4). */
@Controller('auth')
export class PasswordController {
  constructor(
    private readonly requests: PasswordResetRequestService,
    private readonly resets: PasswordResetService,
    private readonly reauths: ReauthService,
  ) {}

  @Public()
  @Post('password/forgot')
  @Audited('auth.password.forgot')
  @Throttle(AUTH_ROUTE_LIMITS.forgotPassword)
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(AcceptedResponseDto)
  async forgot(@Body() body: ForgotPasswordRequestDto, @Req() request: Request): Promise<AcceptedResponse> {
    await this.requests.forgot(body.email, clientContextFrom(request));
    return ACCEPTED;
  }

  @Public()
  @Post('password/reset')
  @Audited('auth.password.reset')
  @Throttle(AUTH_ROUTE_LIMITS.resetPassword)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body() body: ResetPasswordRequestDto, @Req() request: Request): Promise<void> {
    await this.resets.reset(body.token, body.newPassword, clientContextFrom(request));
  }

  @Post('reauth')
  @Audited('auth.reauth')
  @Throttle(AUTH_ROUTE_LIMITS.reauth)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reauth(
    @CurrentSession() session: AuthenticatedSession,
    @Body() body: ReauthRequestDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.reauths.reauth(session, body.password, clientContextFrom(request));
  }
}

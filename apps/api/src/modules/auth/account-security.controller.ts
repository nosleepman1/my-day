import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';

import {
  type AcceptedResponse,
  ChangeEmailRequestSchema,
  ChangePasswordRequestSchema,
  ConfirmEmailChangeRequestSchema,
} from '@orbit/contracts';

import { Audited } from '../../platform/audit/audit.interceptor';
import { Public } from '../../platform/auth/public.decorator';
import { RequireReauth } from '../../platform/auth/require-reauth';
import { CurrentSession } from '../../platform/auth/session-context';
import { serializeSessionCookie } from '../../platform/auth/session-cookie';
import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import { clientContextFrom } from '../../platform/http/client-context';
import { AUTH_ROUTE_LIMITS } from '../../platform/http/rate-limit';

import { AcceptedResponseDto } from './dto/registration.dto';
import { EmailChangeService } from './email-change.service';
import { PasswordChangeService } from './password-change.service';

class ChangeEmailRequestDto extends createZodDto(ChangeEmailRequestSchema) {}
class ConfirmEmailChangeRequestDto extends createZodDto(ConfirmEmailChangeRequestSchema) {}
class ChangePasswordRequestDto extends createZodDto(ChangePasswordRequestSchema) {}

const ACCEPTED: AcceptedResponse = { data: { status: 'accepted' } };

/** Changement d'adresse et de mot de passe de l'utilisateur connecté (API.md §14.3, SECURITY.md §3.6). */
@Controller()
export class AccountSecurityController {
  constructor(
    private readonly emailChanges: EmailChangeService,
    private readonly passwordChanges: PasswordChangeService,
  ) {}

  @Post('me/email')
  @Throttle(AUTH_ROUTE_LIMITS.changeEmail)
  @Audited('auth.email.change_request')
  @RequireReauth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(AcceptedResponseDto)
  async requestEmailChange(
    @CurrentSession() session: AuthenticatedSession,
    @Body() body: ChangeEmailRequestDto,
    @Req() request: Request,
  ): Promise<AcceptedResponse> {
    await this.emailChanges.request(session, body.newEmail, clientContextFrom(request));
    return ACCEPTED;
  }

  @Public()
  @Post('auth/email/change/confirm')
  @Audited('auth.email.change_confirm')
  @Throttle(AUTH_ROUTE_LIMITS.verifyEmail)
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmailChange(
    @Body() body: ConfirmEmailChangeRequestDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.emailChanges.confirm(body.token, clientContextFrom(request));
  }

  @Post('me/password')
  @Audited('auth.password.change')
  @Throttle(AUTH_ROUTE_LIMITS.reauth)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentSession() session: AuthenticatedSession,
    @Body() body: ChangePasswordRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const rotated = await this.passwordChanges.change(session, body, clientContextFrom(request));
    response.setHeader('Set-Cookie', serializeSessionCookie(rotated.token, rotated.maxAgeSeconds));
  }
}

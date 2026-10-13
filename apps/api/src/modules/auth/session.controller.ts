import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';

import type { LoginResponse } from '@orbit/contracts';

import { Public } from '../../platform/auth/public.decorator';
import { CurrentSession } from '../../platform/auth/session-context';
import {
  clearSessionCookie,
  readSessionToken,
  serializeSessionCookie,
} from '../../platform/auth/session-cookie';
import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import { clientContextFrom } from '../../platform/http/client-context';

import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { LoginService } from './login.service';

/** Connexion et déconnexion (API.md §14.3). Le jeton ne circule que dans le cookie `__Host-orbit_sid`. */
@Controller('auth')
export class SessionController {
  constructor(private readonly logins: LoginService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(LoginResponseDto)
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.logins.login(
      body,
      clientContextFrom(request),
      readSessionToken(request.headers.cookie),
    );
    response.setHeader('Set-Cookie', serializeSessionCookie(result.token, result.maxAgeSeconds));
    const { emailVerifiedAt, ...user } = result.user;
    return {
      data: {
        user: { ...user, emailVerifiedAt: emailVerifiedAt?.toISOString() ?? null, mfaEnabled: false },
        mfaRequired: false,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logins.logout(session, clientContextFrom(request));
    response.setHeader('Set-Cookie', clearSessionCookie());
    response.setHeader('Clear-Site-Data', '"cache"');
  }
}

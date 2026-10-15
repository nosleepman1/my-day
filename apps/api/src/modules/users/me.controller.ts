import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { MeResponse, Preferences, PreferencesResponse } from '@orbit/contracts';

import { Audited } from '../../platform/audit/audit.interceptor';
import { CurrentSession } from '../../platform/auth/session-context';
import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';

import {
  MeResponseDto,
  PreferencesResponseDto,
  UpdatePreferencesRequestDto,
  UpdateProfileRequestDto,
} from './dto/me.dto';
import type { PreferencesRecord } from './preferences.repository';
import { toSessionUser } from './session-user';
import { UsersService } from './users.service';

function toPreferences(record: PreferencesRecord): Preferences {
  return {
    ...record,
    onboardingCompletedAt: record.onboardingCompletedAt?.toISOString() ?? null,
  } as Preferences;
}

/** Profil et préférences de l'utilisateur connecté (API.md §14.3). */
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ZodSerializerDto(MeResponseDto)
  async me(@CurrentSession() session: AuthenticatedSession): Promise<MeResponse> {
    return { data: toSessionUser(await this.users.requireProfile(session.userId)) };
  }

  @Patch()
  @Audited('users.profile.update')
  @ZodSerializerDto(MeResponseDto)
  async updateProfile(
    @CurrentSession() session: AuthenticatedSession,
    @Body() body: UpdateProfileRequestDto,
  ): Promise<MeResponse> {
    return { data: toSessionUser(await this.users.updateDisplayName(session.userId, body.displayName)) };
  }

  @Get('preferences')
  @ZodSerializerDto(PreferencesResponseDto)
  async preferences(): Promise<PreferencesResponse> {
    return { data: toPreferences(await this.users.requirePreferences()) };
  }

  @Patch('preferences')
  @Audited('users.preferences.update')
  @ZodSerializerDto(PreferencesResponseDto)
  async updatePreferences(@Body() body: UpdatePreferencesRequestDto): Promise<PreferencesResponse> {
    return { data: toPreferences(await this.users.updatePreferences(body)) };
  }
}

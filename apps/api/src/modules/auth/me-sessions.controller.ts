import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';

import {
  type LoginEventListResponse,
  LoginEventListResponseSchema,
  PaginationQuerySchema,
  SessionIdParamSchema,
  type SessionListResponse,
  SessionListResponseSchema,
} from '@orbit/contracts';

import { Audited } from '../../platform/audit/audit.interceptor';
import { AuditService } from '../../platform/audit/audit.service';
import { CurrentSession } from '../../platform/auth/session-context';
import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import { DomainError } from '../../platform/errors/domain-error';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { ipPrefix } from '../../platform/http/ip-prefix';

import { LoginHistoryService } from './login-history.service';
import { SessionsService } from './sessions.service';

class SessionListResponseDto extends createZodDto(SessionListResponseSchema) {}
class SessionIdParamDto extends createZodDto(SessionIdParamSchema) {}
class PaginationQueryDto extends createZodDto(PaginationQuerySchema) {}
class LoginEventListResponseDto extends createZodDto(LoginEventListResponseSchema) {}

/** Sessions actives et historique de connexion de l'utilisateur connecté (API.md §14.3). */
@Controller('me')
export class MeSessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly history: LoginHistoryService,
    private readonly audit: AuditService,
  ) {}

  @Get('sessions')
  @ZodSerializerDto(SessionListResponseDto)
  async list(@CurrentSession() session: AuthenticatedSession): Promise<SessionListResponse> {
    const active = await this.sessions.listActive(session.userId);
    return {
      data: active.map((row) => ({
        id: row.id,
        current: row.id === session.sessionId,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        ip: ipPrefix(row.ip),
        device: row.userAgentLabel,
      })),
    };
  }

  /** `404` pour une session inconnue ou d'un autre utilisateur (ADR-007-7). */
  @Delete('sessions/:id')
  @Audited('auth.session.revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentSession() session: AuthenticatedSession,
    @Param() params: SessionIdParamDto,
  ): Promise<void> {
    if (await this.sessions.revokeOwned(session.userId, params.id, 'LOGOUT')) return;
    const owner = await this.sessions.ownerOf(params.id);
    if (owner !== null && owner !== session.userId) {
      await this.audit.record({
        action: 'authz.cross_user_attempt',
        userId: owner,
        actorUserId: session.userId,
        entityType: 'sessions',
        entityId: params.id,
        outcome: 'DENIED',
      });
    }
    throw new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
  }

  @Post('sessions/revoke-others')
  @Audited('auth.session.revoke_others')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeOthers(@CurrentSession() session: AuthenticatedSession): Promise<void> {
    await this.sessions.revokeAllForUser(session.userId, 'LOGOUT_ALL', session.sessionId);
  }

  @Get('login-events')
  @ZodSerializerDto(LoginEventListResponseDto)
  loginEvents(@Query() query: PaginationQueryDto): Promise<LoginEventListResponse> {
    return this.history.list(query);
  }
}

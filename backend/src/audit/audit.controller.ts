import { Controller, Get, Query, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { CurrentAuth, RequirePermissions } from '../authz/decorators';
import { ErrorDto, PaginationQuery, paginated } from '../common/dto';
import { AuthContext, clientMeta } from '../common/request-context';
import { AuditEventEntity } from '../database/entities';
import { AUDIT_ACTIONS, AuditService } from './audit.service';

class AuditQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: string;

  @ApiPropertyOptional({ enum: ['success', 'denied', 'failure'] })
  @IsOptional()
  @IsIn(['success', 'denied', 'failure'])
  outcome?: 'success' | 'denied' | 'failure';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

class AuditActorDto {
  @ApiProperty({ format: 'uuid', nullable: true }) id!: string | null;
  @ApiProperty({ nullable: true }) email!: string | null;
}

class AuditEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: AUDIT_ACTIONS }) action!: string;
  @ApiProperty({ enum: ['success', 'denied', 'failure'] }) outcome!: string;
  @ApiProperty({ type: AuditActorDto }) actor!: AuditActorDto;
  @ApiProperty({ nullable: true }) resourceType!: string | null;
  @ApiProperty({ nullable: true }) resourceId!: string | null;
  @ApiProperty({ nullable: true }) ip!: string | null;
  @ApiProperty({ nullable: true }) requestId!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  details!: Record<string, unknown> | null;
}

class AuditPageDto {
  @ApiProperty({ type: [AuditEventDto] }) items!: AuditEventDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

@ApiTags('audit')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ type: ErrorDto })
@ApiForbiddenResponse({ type: ErrorDto })
@Controller('audit-events')
export class AuditController {
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repo: Repository<AuditEventEntity>,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary: 'Eventos de auditoría (admin), más recientes primero',
  })
  @ApiOkResponse({ type: AuditPageDto })
  async list(
    @Query() q: AuditQuery,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AuditPageDto> {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.seq', 'DESC');
    if (q.action) qb.andWhere('e.action = :action', { action: q.action });
    if (q.outcome) qb.andWhere('e.outcome = :outcome', { outcome: q.outcome });
    if (q.actorId) qb.andWhere('e.actor_id = :actorId', { actorId: q.actorId });
    if (q.from) qb.andWhere('e.occurred_at >= :from', { from: q.from });
    if (q.to) qb.andWhere('e.occurred_at <= :to', { to: q.to });
    const [rows, total] = await qb
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize)
      .getManyAndCount();
    await this.audit.record({
      action: 'audit.read',
      outcome: 'success',
      actorId: auth.userId,
      actorEmail: auth.email,
      ...clientMeta(req),
      details: { page: q.page, filterAction: q.action ?? null },
    });
    return paginated(
      rows.map((e) => ({
        id: e.id,
        occurredAt: e.occurredAt.toISOString(),
        action: e.action,
        outcome: e.outcome,
        actor: { id: e.actorId, email: e.actorEmail },
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        ip: e.ip,
        requestId: e.requestId,
        details: e.details,
      })),
      q.page,
      q.pageSize,
      total,
    );
  }
}

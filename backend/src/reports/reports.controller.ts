import { Controller, Get, Query, Req } from '@nestjs/common';
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
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions } from '../authz/decorators';
import { ErrorDto } from '../common/dto';
import { AuthContext, clientMeta } from '../common/request-context';

class SummaryQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 90, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days = 7;
}

class SummaryDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ format: 'date-time' }) periodStart!: string;
  @ApiProperty({
    example: {
      total: 5,
      totalBytes: 1024,
      byClassification: { internal: 3, confidential: 1, restricted: 1 },
    },
  })
  documents!: {
    total: number;
    totalBytes: number;
    byClassification: Record<string, number>;
  };
  @ApiProperty({
    example: {
      total: 3,
      mfaEnabled: 2,
      byRole: { admin: 1, editor: 1, reader: 1 },
      disabled: 0,
    },
  })
  users!: {
    total: number;
    mfaEnabled: number;
    disabled: number;
    byRole: Record<string, number>;
  };
  @ApiProperty({
    example: {
      byOutcome: { success: 10, denied: 2, failure: 1 },
      failedLogins: 1,
      accessDenied: 2,
      integrityFailures: 0,
      uploads: 3,
      downloads: 4,
    },
  })
  events!: Record<string, unknown>;
}

@ApiTags('reports')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ type: ErrorDto })
@ApiForbiddenResponse({ type: ErrorDto })
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditService,
  ) {}

  @Get('summary')
  @RequirePermissions('reports:read')
  @ApiOperation({
    summary: 'Estadísticas agregadas (admin); sin contenido ni secretos',
  })
  @ApiOkResponse({ type: SummaryDto })
  async summary(
    @Query() q: SummaryQuery,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<SummaryDto> {
    const since = new Date(Date.now() - q.days * 86_400_000);
    const count = (rows: { k: string; n: string }[]) =>
      Object.fromEntries(rows.map((r) => [r.k, Number(r.n)]));

    const docRows: { k: string; n: string; b: string }[] = await this.db.query(
      'SELECT classification AS k, COUNT(*) AS n, COALESCE(SUM(size_bytes),0) AS b FROM documents GROUP BY classification',
    );
    const roleRows = await this.db.query(
      'SELECT role AS k, COUNT(*) AS n FROM users GROUP BY role',
    );
    const [userAgg] = await this.db.query(
      "SELECT COUNT(*) AS total, SUM(mfa_enabled) AS mfa, SUM(status = 'disabled') AS disabled FROM users",
    );
    const outcomeRows = await this.db.query(
      'SELECT outcome AS k, COUNT(*) AS n FROM audit_events WHERE occurred_at >= ? GROUP BY outcome',
      [since],
    );
    const actionRows: { k: string; n: string }[] = await this.db.query(
      `SELECT CONCAT(action, ':', outcome) AS k, COUNT(*) AS n FROM audit_events
       WHERE occurred_at >= ? AND action IN ('auth.login','access.denied','document.integrity_failed','document.upload','document.download')
       GROUP BY action, outcome`,
      [since],
    );
    const a = count(actionRows);
    await this.audit.record({
      action: 'report.read',
      outcome: 'success',
      actorId: auth.userId,
      actorEmail: auth.email,
      ...clientMeta(req),
      details: { days: q.days },
    });
    return {
      generatedAt: new Date().toISOString(),
      periodStart: since.toISOString(),
      documents: {
        total: docRows.reduce((s, r) => s + Number(r.n), 0),
        totalBytes: docRows.reduce((s, r) => s + Number(r.b), 0),
        byClassification: {
          internal: 0,
          confidential: 0,
          restricted: 0,
          ...count(docRows),
        },
      },
      users: {
        total: Number(userAgg.total),
        mfaEnabled: Number(userAgg.mfa ?? 0),
        disabled: Number(userAgg.disabled ?? 0),
        byRole: { admin: 0, editor: 0, reader: 0, ...count(roleRows) },
      },
      events: {
        byOutcome: { success: 0, denied: 0, failure: 0, ...count(outcomeRows) },
        failedLogins: a['auth.login:failure'] ?? 0,
        accessDenied: a['access.denied:denied'] ?? 0,
        integrityFailures: a['document.integrity_failed:failure'] ?? 0,
        uploads: a['document.upload:success'] ?? 0,
        downloads: a['document.download:success'] ?? 0,
      },
    };
  }
}

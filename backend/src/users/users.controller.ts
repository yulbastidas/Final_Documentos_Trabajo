import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import {
  Authenticated,
  CurrentAuth,
  RequirePermissions,
} from '../authz/decorators';
import { Errors } from '../common/api-error';
import { ErrorDto, paginated } from '../common/dto';
import { AuthContext, clientMeta } from '../common/request-context';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
  UserDto,
  UserPageDto,
  toUserDto,
} from './dto';
import { UsersService } from './users.service';

const uuidPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => Errors.notFound('Usuario'),
});

@ApiTags('users')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  type: ErrorDto,
  description: 'AUTH_REQUIRED / SESSION_EXPIRED',
})
@ApiForbiddenResponse({
  type: ErrorDto,
  description: 'FORBIDDEN / CSRF_INVALID',
})
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  @Authenticated()
  @ApiOperation({
    summary: 'Perfil, rol y permisos efectivos del usuario actual',
  })
  @ApiOkResponse({ type: UserDto })
  async me(@CurrentAuth() auth: AuthContext): Promise<UserDto> {
    const user = await this.users.findById(auth.userId);
    if (!user) throw Errors.authRequired();
    return toUserDto(user);
  }

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar usuarios (admin)' })
  @ApiOkResponse({ type: UserPageDto })
  async list(@Query() q: ListUsersQuery): Promise<UserPageDto> {
    const { items, total } = await this.users.list(q);
    return paginated(items.map(toUserDto), q.page, q.pageSize, total);
  }

  @Post()
  @RequirePermissions('users:manage')
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Crear usuario con rol asignado por un admin (alta controlada)',
  })
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'EMAIL_ALREADY_REGISTERED',
  })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<UserDto> {
    const user = await this.users.create(dto);
    await this.audit.record({
      action: 'user.create',
      outcome: 'success',
      actorId: auth.userId,
      actorEmail: auth.email,
      resourceType: 'user',
      resourceId: user.id,
      ...clientMeta(req),
      details: { role: user.role },
    });
    return toUserDto(user);
  }

  @Patch(':id')
  @RequirePermissions('users:manage')
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Cambiar rol o estado (admin)',
    description:
      'No se permite modificarse a sí mismo ni dejar el sistema sin admin activo. Revoca las sesiones del usuario.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse({ type: ErrorDto })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'SELF_MODIFICATION / LAST_ADMIN',
  })
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<UserDto> {
    try {
      const { target, before } = await this.users.update(auth.userId, id, dto);
      await this.audit.record({
        action: 'user.update',
        outcome: 'success',
        actorId: auth.userId,
        actorEmail: auth.email,
        resourceType: 'user',
        resourceId: id,
        ...clientMeta(req),
        details: {
          fromRole: before.role,
          toRole: target.role,
          fromStatus: before.status,
          toStatus: target.status,
        },
      });
      return toUserDto(target);
    } catch (e) {
      await this.audit.record({
        action: 'user.update',
        outcome: 'failure',
        actorId: auth.userId,
        actorEmail: auth.email,
        resourceType: 'user',
        resourceId: id,
        ...clientMeta(req),
        details: { reason: (e as { code?: string }).code ?? 'error' },
      });
      throw e;
    }
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { Authenticated, CurrentAuth, Public } from '../authz/decorators';
import { Errors } from '../common/api-error';
import { ErrorDto } from '../common/dto';
import { AuthRateLimit } from '../common/rate-limit';
import { AuthContext, clientMeta } from '../common/request-context';
import { UserDto, toUserDto } from '../users/dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import {
  LoginDto,
  MfaDisableDto,
  MfaRequiredDto,
  MfaSetupDto,
  MfaVerifyDto,
  RecoveryCodesDto,
  RegisterDto,
  SessionInfoDto,
  TotpCodeDto,
} from './dto';
import { MfaService } from './mfa.service';
import { verifyPassword } from './password';
import { SessionService } from './session.service';

@ApiTags('auth')
@ApiExtraModels(SessionInfoDto, MfaRequiredDto)
@ApiTooManyRequestsResponse({ type: ErrorDto, description: 'RATE_LIMITED' })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Post('register')
  @Public()
  @AuthRateLimit()
  @ApiOperation({
    summary: 'Alta pública con rol reader (si REGISTRATION_MODE=open)',
  })
  @ApiCreatedResponse({ type: UserDto })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'VALIDATION_FAILED' })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'EMAIL_ALREADY_REGISTERED',
  })
  @ApiForbiddenResponse({
    type: ErrorDto,
    description: 'REGISTRATION_CLOSED / ORIGIN_NOT_ALLOWED',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<UserDto> {
    return toUserDto(await this.auth.register(dto, clientMeta(req)));
  }

  @Post('login')
  @Public()
  @AuthRateLimit()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicio de sesión',
    description:
      'Sin MFA: crea la sesión (cookie HttpOnly) y devuelve status=authenticated. ' +
      'Con MFA: devuelve status=mfa_required y challengeId para /auth/mfa/verify.',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SessionInfoDto) },
        { $ref: getSchemaPath(MfaRequiredDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description: 'INVALID_CREDENTIALS',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionInfoDto | MfaRequiredDto> {
    const result = await this.auth.login(dto, clientMeta(req));
    if (result.kind === 'mfa')
      return {
        status: 'mfa_required',
        challengeId: result.challengeId,
        expiresAt: result.expiresAt.toISOString(),
      };
    this.sessions.setCookie(res, result.token, result.session);
    return this.auth.sessionInfo(result.user, result.session, result.token);
  }

  @Post('mfa/verify')
  @Public()
  @AuthRateLimit()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Completa el desafío MFA con TOTP o código de recuperación',
  })
  @ApiOkResponse({ type: SessionInfoDto })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'MFA_INVALID' })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionInfoDto> {
    const { token, session, user } = await this.auth.verifyMfa(
      dto,
      clientMeta(req),
    );
    this.sessions.setCookie(res, token, session);
    return this.auth.sessionInfo(user, session, token);
  }

  @Get('session')
  @Authenticated()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Sesión actual y token CSRF (por ejemplo tras recargar la página)',
  })
  @ApiOkResponse({ type: SessionInfoDto })
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description: 'AUTH_REQUIRED / SESSION_EXPIRED',
  })
  async session(@CurrentAuth() auth: AuthContext): Promise<SessionInfoDto> {
    const user = await this.users.findById(auth.userId);
    if (!user) throw Errors.authRequired();
    return this.auth.sessionInfo(user, auth, auth.sessionToken);
  }

  @Post('logout')
  @Authenticated()
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiSecurity('csrf')
  @ApiNoContentResponse({ description: 'Sesión revocada y cookie eliminada' })
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.revoke(auth.sessionId);
    this.sessions.clearCookie(res);
    await this.audit.record({
      action: 'auth.logout',
      outcome: 'success',
      actorId: auth.userId,
      actorEmail: auth.email,
      ...clientMeta(req),
    });
  }

  @Post('mfa/setup')
  @Authenticated()
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Inicia el enrolamiento TOTP (secreto pendiente de confirmar)',
  })
  @ApiOkResponse({ type: MfaSetupDto })
  @ApiConflictResponse({ type: ErrorDto, description: 'MFA_ALREADY_ENABLED' })
  async setup(
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<MfaSetupDto> {
    const user = await this.requireUser(auth);
    const result = await this.mfa.beginEnrollment(user);
    await this.audit.record({
      action: 'auth.mfa.enroll',
      outcome: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ...clientMeta(req),
    });
    return result;
  }

  @Post('mfa/confirm')
  @Authenticated()
  @AuthRateLimit()
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Confirma el TOTP, activa MFA y entrega códigos de recuperación',
  })
  @ApiOkResponse({ type: RecoveryCodesDto })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'MFA_INVALID' })
  @ApiConflictResponse({
    type: ErrorDto,
    description: 'MFA_SETUP_REQUIRED / MFA_ALREADY_ENABLED',
  })
  async confirm(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TotpCodeDto,
    @Req() req: Request,
  ): Promise<RecoveryCodesDto> {
    const user = await this.requireUser(auth);
    try {
      const recoveryCodes = await this.mfa.confirmEnrollment(user, dto.code);
      // Cerrar otras sesiones: a partir de ahora requieren el segundo factor.
      await this.sessions.revokeAllForUser(user.id, auth.sessionId);
      await this.audit.record({
        action: 'auth.mfa.confirm',
        outcome: 'success',
        actorId: user.id,
        actorEmail: user.email,
        ...clientMeta(req),
      });
      return { recoveryCodes };
    } catch (e) {
      await this.audit.record({
        action: 'auth.mfa.confirm',
        outcome: 'failure',
        actorId: user.id,
        actorEmail: user.email,
        ...clientMeta(req),
      });
      throw e;
    }
  }

  @Post('mfa/disable')
  @Authenticated()
  @AuthRateLimit()
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Desactiva MFA (requiere contraseña y TOTP vigente)',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description: 'MFA_INVALID / INVALID_CREDENTIALS',
  })
  async disable(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MfaDisableDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(auth);
    const passwordOk = await verifyPassword(user.passwordHash, dto.password);
    const codeOk =
      passwordOk && (await this.mfa.verifyUserTotp(user, dto.code));
    if (!codeOk) {
      await this.audit.record({
        action: 'auth.mfa.disable',
        outcome: 'failure',
        actorId: user.id,
        actorEmail: user.email,
        ...clientMeta(req),
      });
      throw passwordOk ? Errors.mfaInvalid() : Errors.invalidCredentials();
    }
    await this.mfa.disable(user);
    await this.audit.record({
      action: 'auth.mfa.disable',
      outcome: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ...clientMeta(req),
    });
  }

  @Post('mfa/recovery-codes')
  @Authenticated()
  @AuthRateLimit()
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Regenera los códigos de recuperación (invalida los anteriores)',
  })
  @ApiOkResponse({ type: RecoveryCodesDto })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'MFA_INVALID' })
  async regenerate(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TotpCodeDto,
    @Req() req: Request,
  ): Promise<RecoveryCodesDto> {
    const user = await this.requireUser(auth);
    if (!(await this.mfa.verifyUserTotp(user, dto.code))) {
      await this.audit.record({
        action: 'auth.mfa.recovery_regenerate',
        outcome: 'failure',
        actorId: user.id,
        actorEmail: user.email,
        ...clientMeta(req),
      });
      throw Errors.mfaInvalid();
    }
    const recoveryCodes = await this.mfa.regenerateRecoveryCodes(user.id);
    await this.audit.record({
      action: 'auth.mfa.recovery_regenerate',
      outcome: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ...clientMeta(req),
    });
    return { recoveryCodes };
  }

  private async requireUser(auth: AuthContext) {
    const user = await this.users.findById(auth.userId);
    if (!user) throw Errors.authRequired();
    return user;
  }
}

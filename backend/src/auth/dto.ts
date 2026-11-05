import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';
import { DISPLAY_NAME, EmailPasswordFields, UserDto } from '../users/dto';

export class RegisterDto extends EmailPasswordFields {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Ana Prueba' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  @Matches(DISPLAY_NAME, {
    message: 'displayName contiene caracteres no permitidos',
  })
  displayName!: string;
}

export class LoginDto extends EmailPasswordFields {}

export class MfaVerifyDto {
  @ApiProperty({
    description: 'Valor devuelto por /auth/login cuando status=mfa_required',
  })
  @IsString()
  @Length(20, 100)
  challengeId!: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Código TOTP; usar code o recoveryCode',
  })
  @ValidateIf((o: MfaVerifyDto) => o.recoveryCode === undefined)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code debe tener 6 dígitos' })
  code?: string;

  @ApiPropertyOptional({
    example: 'ABCDE-FGHIJ',
    description: 'Código de recuperación de un solo uso',
  })
  @ValidateIf((o: MfaVerifyDto) => o.code === undefined)
  @IsString()
  @Matches(/^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/, {
    message: 'recoveryCode con formato inválido',
  })
  recoveryCode?: string;
}

export class TotpCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code debe tener 6 dígitos' })
  code!: string;
}

export class MfaDisableDto extends TotpCodeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class SessionInfoDto {
  @ApiProperty({ enum: ['authenticated'] }) status!: 'authenticated';
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiProperty({
    description:
      'Enviar en el encabezado X-CSRF-Token en POST/PUT/PATCH/DELETE',
  })
  csrfToken!: string;
  @ApiProperty({ format: 'date-time' }) idleExpiresAt!: string;
  @ApiProperty({ format: 'date-time' }) absoluteExpiresAt!: string;
}

export class MfaRequiredDto {
  @ApiProperty({ enum: ['mfa_required'] }) status!: 'mfa_required';
  @ApiProperty() challengeId!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class MfaSetupDto {
  @ApiProperty({ description: 'Secreto base32; mostrar una sola vez' })
  secret!: string;
  @ApiProperty({ example: 'otpauth://totp/SecureDocs:ana%40example.test?...' })
  otpauthUri!: string;
}

export class RecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: 'Mostrar una sola vez; no se pueden recuperar',
  })
  recoveryCodes!: string[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQuery } from '../common/dto';
import {
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from '../authz/permissions';
import type { UserEntity } from '../database/entities';
import { ROLE_PERMISSIONS } from '../authz/permissions';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Nombre visible: letras, números, espacios y puntuación básica; sin < >.
export const DISPLAY_NAME = /^[\p{L}\p{N} .,'_-]+$/u;

export class EmailPasswordFields {
  @ApiProperty({ example: 'ana@example.test', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsString()
  @MaxLength(254)
  @IsEmail({ allow_display_name: false, allow_ip_domain: false })
  email!: string;

  @ApiProperty({
    minLength: 12,
    maxLength: 128,
    example: 'Prueba-Sintetica-2026',
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class CreateUserDto extends EmailPasswordFields {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Ana Prueba' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  @Matches(DISPLAY_NAME, {
    message: 'displayName contiene caracteres no permitidos',
  })
  displayName!: string;

  @ApiProperty({ enum: ROLES, example: 'reader' })
  @IsIn(ROLES)
  role!: Role;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}

export class ListUsersQuery extends PaginationQuery {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Busca en correo y nombre',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ROLES }) role!: Role;
  @ApiProperty({ enum: ['active', 'disabled'] }) status!: 'active' | 'disabled';
  @ApiProperty() mfaEnabled!: boolean;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions!: Permission[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class UserPageDto {
  @ApiProperty({ type: [UserDto] }) items!: UserDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export function toUserDto(u: UserEntity): UserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    permissions: [...ROLE_PERMISSIONS[u.role]],
    createdAt: u.createdAt.toISOString(),
  };
}

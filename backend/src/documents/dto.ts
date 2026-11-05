import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { CLASSIFICATIONS, type Classification } from '../authz/permissions';
import { PaginationQuery } from '../common/dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UploadDocumentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 120,
    example: 'Acta sintética de integración',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  @Matches(/^[^\u0000-\u001f\u007f<>]+$/u, {
    message: 'title contiene caracteres no permitidos',
  })
  title!: string;

  @ApiProperty({ enum: CLASSIFICATIONS, example: 'internal' })
  @IsIn(CLASSIFICATIONS)
  classification!: Classification;
}

export class UploadDocumentForm extends UploadDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'PDF o TXT (UTF-8), máx. UPLOAD_MAX_BYTES',
  })
  file!: unknown;
}

export const SORTS = {
  createdAt: 'd.created_at',
  title: 'd.title',
  size: 'd.size_bytes',
} as const;

export class ListDocumentsQuery extends PaginationQuery {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Busca en título y nombre de archivo',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CLASSIFICATIONS })
  @IsOptional()
  @IsIn(CLASSIFICATIONS)
  classification?: Classification;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: solo favoritos del usuario',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({ enum: ['all', 'mine'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'mine'])
  scope: 'all' | 'mine' = 'all';

  @ApiPropertyOptional({ enum: Object.keys(SORTS), default: 'createdAt' })
  @IsOptional()
  @IsIn(Object.keys(SORTS))
  sort: keyof typeof SORTS = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class DocumentOwnerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() displayName!: string;
}

export class DocumentPermissionsDto {
  @ApiProperty() canDownload!: boolean;
  @ApiProperty() canDelete!: boolean;
}

export class DocumentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ example: 'acta.txt' }) filename!: string;
  @ApiProperty({ example: 'text/plain; charset=utf-8' }) mimeType!: string;
  @ApiProperty({ description: 'Bytes del original' }) size!: number;
  @ApiProperty({ enum: CLASSIFICATIONS }) classification!: Classification;
  @ApiProperty({ description: 'SHA-256 (hex) del contenido original' })
  sha256!: string;
  @ApiProperty({ type: DocumentOwnerDto }) owner!: DocumentOwnerDto;
  @ApiProperty() favorite!: boolean;
  @ApiProperty({ type: DocumentPermissionsDto })
  permissions!: DocumentPermissionsDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class DocumentPageDto {
  @ApiProperty({ type: [DocumentDto] }) items!: DocumentDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

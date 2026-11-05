import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ErrorDetailDto {
  @ApiProperty({ example: 'email' }) field!: string;
  @ApiProperty({ example: 'email must be an email' }) message!: string;
}

export class ErrorDto {
  @ApiProperty({ example: 'VALIDATION_FAILED' }) code!: string;
  @ApiProperty({ example: 'Datos de entrada inválidos.' }) message!: string;
  @ApiProperty({ example: '7d7f3a52-3f1e-4a42-9f8e-1a2b3c4d5e6f' })
  requestId!: string;
  @ApiPropertyOptional({ type: [ErrorDetailDto] }) details?: ErrorDetailDto[];
}

export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
) {
  return { items, page, pageSize, total };
}

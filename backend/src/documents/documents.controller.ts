import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentAuth, RequirePermissions } from '../authz/decorators';
import { Errors } from '../common/api-error';
import { ErrorDto, paginated } from '../common/dto';
import { AuthContext, clientMeta } from '../common/request-context';
import { DocumentsService } from './documents.service';
import {
  DocumentDto,
  DocumentPageDto,
  ListDocumentsQuery,
  UploadDocumentDto,
  UploadDocumentForm,
} from './dto';

const uuidPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => Errors.notFound('Documento'),
});

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@ApiTags('documents')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  type: ErrorDto,
  description: 'AUTH_REQUIRED / SESSION_EXPIRED',
})
@ApiForbiddenResponse({
  type: ErrorDto,
  description: 'FORBIDDEN / CSRF_INVALID',
})
@Controller('documents')
export class DocumentsController {
  private readonly maxBytes: number;
  constructor(
    private readonly documents: DocumentsService,
    config: ConfigService,
  ) {
    this.maxBytes = config.getOrThrow<number>('UPLOAD_MAX_BYTES');
  }

  @Post()
  @RequirePermissions('documents:create')
  @ApiSecurity('csrf')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentForm })
  @ApiOperation({
    summary: 'Subir PDF/TXT; se cifra con AES-256-GCM antes de guardarse',
  })
  @ApiCreatedResponse({ type: DocumentDto })
  @ApiPayloadTooLargeResponse({
    type: ErrorDto,
    description: 'PAYLOAD_TOO_LARGE',
  })
  @ApiUnsupportedMediaTypeResponse({
    type: ErrorDto,
    description: 'UNSUPPORTED_FILE_TYPE',
  })
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<DocumentDto> {
    if (!file)
      throw Errors.validation([
        { field: 'file', message: 'Adjunta un archivo en el campo file' },
      ]);
    return this.documents.upload(
      auth,
      file,
      dto,
      this.maxBytes,
      clientMeta(req),
    );
  }

  @Get()
  @RequirePermissions('documents:read')
  @ApiOperation({
    summary: 'Listar documentos visibles para el usuario (paginado)',
  })
  @ApiOkResponse({ type: DocumentPageDto })
  async list(
    @Query() q: ListDocumentsQuery,
    @CurrentAuth() auth: AuthContext,
  ): Promise<DocumentPageDto> {
    const { items, total } = await this.documents.list(auth, q);
    return paginated(items, q.page, q.pageSize, total);
  }

  @Get(':id')
  @RequirePermissions('documents:read')
  @ApiOperation({ summary: 'Metadatos de un documento' })
  @ApiOkResponse({ type: DocumentDto })
  @ApiNotFoundResponse({
    type: ErrorDto,
    description: 'Inexistente o no autorizado',
  })
  get(
    @Param('id', uuidPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<DocumentDto> {
    return this.documents.get(auth, id);
  }

  @Get(':id/download')
  @RequirePermissions('documents:read')
  @ApiOperation({
    summary: 'Descarga el original descifrado tras verificar tag GCM y SHA-256',
  })
  @ApiProduces('application/pdf', 'text/plain')
  @ApiOkResponse({ description: 'Binario con Content-Disposition: attachment' })
  @ApiNotFoundResponse({ type: ErrorDto })
  @ApiInternalServerErrorResponse({
    type: ErrorDto,
    description: 'DOCUMENT_INTEGRITY_FAILED',
  })
  async download(
    @Param('id', uuidPipe) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { content, row } = await this.documents.download(
      auth,
      id,
      clientMeta(req),
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Document-SHA256', row.sha256);
    return new StreamableFile(content, {
      type: row.mimeType,
      length: content.length,
      disposition: contentDisposition(row.originalFilename),
    });
  }

  @Delete(':id')
  @RequirePermissions('documents:delete')
  @HttpCode(204)
  @ApiSecurity('csrf')
  @ApiOperation({
    summary: 'Eliminar (admin: cualquiera; editor: solo propios)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorDto })
  async remove(
    @Param('id', uuidPipe) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ) {
    await this.documents.remove(auth, id, clientMeta(req));
  }

  @Put(':id/favorite')
  @RequirePermissions('documents:favorite')
  @HttpCode(204)
  @ApiSecurity('csrf')
  @ApiOperation({ summary: 'Marcar como favorito (idempotente)' })
  @ApiNoContentResponse()
  async favorite(
    @Param('id', uuidPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    await this.documents.setFavorite(auth, id, true);
  }

  @Delete(':id/favorite')
  @RequirePermissions('documents:favorite')
  @HttpCode(204)
  @ApiSecurity('csrf')
  @ApiOperation({ summary: 'Quitar de favoritos (idempotente)' })
  @ApiNoContentResponse()
  async unfavorite(
    @Param('id', uuidPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    await this.documents.setFavorite(auth, id, false);
  }
}

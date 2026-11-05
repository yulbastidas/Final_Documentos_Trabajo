import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, [string, string]> = {
  400: ['BAD_REQUEST', 'Solicitud inválida.'],
  401: ['AUTH_REQUIRED', 'Inicia sesión.'],
  403: ['FORBIDDEN', 'No tienes permiso para esta operación.'],
  404: ['NOT_FOUND', 'Recurso no encontrado.'],
  405: ['METHOD_NOT_ALLOWED', 'Método no permitido.'],
  409: ['CONFLICT', 'Conflicto con el estado actual.'],
  413: ['PAYLOAD_TOO_LARGE', 'La solicitud supera el tamaño permitido.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Formato no admitido.'],
  429: ['RATE_LIMITED', 'Demasiadas solicitudes. Intenta más tarde.'],
};

/**
 * Sobre de error uniforme {code, message, requestId[, details]}.
 * Nunca devuelve trazas, SQL ni mensajes internos de excepciones no previstas.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      code: 'INTERNAL_ERROR',
      message: 'Error interno. Usa requestId para reportarlo.',
    };

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = { code: 'RATE_LIMITED', message: DEFAULT_CODES[429][1] };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response
      ) {
        const r = response as Record<string, unknown>;
        body = { code: r.code, message: r.message };
        if (r.details) body.details = r.details;
      } else {
        const [code, message] = DEFAULT_CODES[status] ?? [
          status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          status >= 500 ? 'Error interno.' : 'Solicitud no procesable.',
        ];
        body = { code, message };
      }
    } else if (bodyParserType(exception) === 'entity.too.large') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      body = { code: 'PAYLOAD_TOO_LARGE', message: DEFAULT_CODES[413][1] };
    } else if (bodyParserType(exception)?.startsWith('entity.')) {
      status = HttpStatus.BAD_REQUEST;
      body = {
        code: 'BAD_REQUEST',
        message: 'Cuerpo de la solicitud inválido.',
      };
    } else if (isMulterLimit(exception)) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      body = {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'El archivo supera el tamaño permitido.',
      };
    }

    if (status >= 500) {
      // Solo nombre del error y requestId: sin mensaje, SQL ni parámetros.
      const name = exception instanceof Error ? exception.name : 'Unknown';
      this.logger.error(
        `${req.method} ${req.path} -> ${status} ${name} requestId=${requestId}`,
      );
    }

    res.status(status).json({ ...body, requestId });
  }
}

/** Errores de body-parser (JSON malformado, cuerpo excesivo, charset). */
function bodyParserType(e: unknown): string | undefined {
  const type = (e as { type?: unknown } | null)?.type;
  return typeof type === 'string' ? type : undefined;
}

function isMulterLimit(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { name?: string }).name === 'MulterError' &&
    String((e as { code?: string }).code).startsWith('LIMIT_')
  );
}

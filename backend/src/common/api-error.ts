import { HttpException, HttpStatus } from '@nestjs/common';

/** Error de API con código estable que el frontend puede interpretar. */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: { field: string; message: string }[],
  ) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  validation: (details: { field: string; message: string }[]) =>
    new ApiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Datos de entrada inválidos.',
      details,
    ),
  authRequired: () =>
    new ApiError(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'Inicia sesión.'),
  sessionExpired: () =>
    new ApiError(
      HttpStatus.UNAUTHORIZED,
      'SESSION_EXPIRED',
      'La sesión expiró. Inicia sesión de nuevo.',
    ),
  invalidCredentials: () =>
    new ApiError(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'Correo o contraseña incorrectos.',
    ),
  mfaInvalid: () =>
    new ApiError(
      HttpStatus.UNAUTHORIZED,
      'MFA_INVALID',
      'El código no es válido o el desafío expiró.',
    ),
  forbidden: () =>
    new ApiError(
      HttpStatus.FORBIDDEN,
      'FORBIDDEN',
      'No tienes permiso para esta operación.',
    ),
  csrf: () =>
    new ApiError(
      HttpStatus.FORBIDDEN,
      'CSRF_INVALID',
      'Solicitud rechazada: falta o no coincide el token CSRF.',
    ),
  origin: () =>
    new ApiError(
      HttpStatus.FORBIDDEN,
      'ORIGIN_NOT_ALLOWED',
      'Origen de la solicitud no permitido.',
    ),
  notFound: (what = 'Recurso') =>
    new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} no encontrado.`),
  conflict: (code: string, message: string) =>
    new ApiError(HttpStatus.CONFLICT, code, message),
  payloadTooLarge: () =>
    new ApiError(
      HttpStatus.PAYLOAD_TOO_LARGE,
      'PAYLOAD_TOO_LARGE',
      'El archivo supera el tamaño permitido.',
    ),
  unsupportedType: (message: string) =>
    new ApiError(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'UNSUPPORTED_FILE_TYPE',
      message,
    ),
  integrity: () =>
    new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'DOCUMENT_INTEGRITY_FAILED',
      'El documento no superó la verificación de integridad y no se entregará.',
    ),
  storage: () =>
    new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'STORAGE_ERROR',
      'No se pudo completar la operación de almacenamiento.',
    ),
  registrationClosed: () =>
    new ApiError(
      HttpStatus.FORBIDDEN,
      'REGISTRATION_CLOSED',
      'El registro público está desactivado. Solicita una cuenta a un administrador.',
    ),
};

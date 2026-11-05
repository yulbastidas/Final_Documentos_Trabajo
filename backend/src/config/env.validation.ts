import * as Joi from 'joi';

// Las claves (DOCUMENT_KEK, MFA_ENCRYPTION_KEY, CSRF_SECRET) se validan en
// KeyService al iniciar los módulos que las usan: base64 de 32 bytes, en VAR
// o en VAR_FILE (ruta a un archivo). Nunca se versionan.
const optionalSecret = Joi.string().allow('').optional();

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  TRUST_PROXY: Joi.number().integer().min(0).max(5).default(0),

  DB_ENABLED: Joi.boolean().default(false),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().default('securedocs_app'),
  DB_NAME: Joi.string().default('securedocs'),
  DB_PASSWORD: Joi.when('DB_ENABLED', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  // El entrypoint de la imagen resuelve este secreto antes de iniciar Node.
  DB_PASSWORD_FILE: Joi.string().allow('').optional(),

  REGISTRATION_MODE: Joi.string().valid('open', 'closed').default('open'),
  SESSION_IDLE_MINUTES: Joi.number().integer().min(1).max(240).default(30),
  SESSION_ABSOLUTE_HOURS: Joi.number().integer().min(1).max(24).default(8),
  COOKIE_SECURE: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.valid(true).default(true),
    otherwise: Joi.boolean().default(false),
  }),
  LOGIN_MAX_FAILURES: Joi.number().integer().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: Joi.number().integer().min(1).max(1440).default(15),
  // Límite global de solicitudes por IP y minuto; auth usa límites propios.
  RATE_LIMIT_PER_MINUTE: Joi.number().integer().min(10).default(120),
  AUTH_RATE_LIMIT_PER_MINUTE: Joi.number().integer().min(1).default(10),

  STORAGE_DIR: Joi.string().default('../storage/documents'),
  UPLOAD_MAX_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(50 * 1024 * 1024)
    .default(10 * 1024 * 1024),

  DOCUMENT_KEK_ID: Joi.string()
    .pattern(/^[a-z0-9-]{1,32}$/)
    .default('k1'),
  DOCUMENT_KEK: optionalSecret,
  DOCUMENT_KEK_FILE: optionalSecret,
  // Claves anteriores, solo para descifrar: "id:base64,id2:base64".
  DOCUMENT_KEK_PREVIOUS: optionalSecret,
  MFA_ENCRYPTION_KEY: optionalSecret,
  MFA_ENCRYPTION_KEY_FILE: optionalSecret,
  CSRF_SECRET: optionalSecret,
  CSRF_SECRET_FILE: optionalSecret,
});

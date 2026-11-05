import { SetMetadata } from '@nestjs/common';

export const AUTH_LIMIT_KEY = 'securedocs:auth-rate-limit';
/** Aplica el límite estricto "auth" (por IP) además del límite global. */
export const AuthRateLimit = () => SetMetadata(AUTH_LIMIT_KEY, true);

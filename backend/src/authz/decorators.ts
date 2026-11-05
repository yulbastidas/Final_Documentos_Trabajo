import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../common/request-context';
import type { Permission } from './permissions';

export const PUBLIC_KEY = 'securedocs:public';
export const PERMISSIONS_KEY = 'securedocs:permissions';

/** Ruta sin sesión (registro, login, salud). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Cualquier usuario con sesión válida. */
export const Authenticated = () => SetMetadata(PERMISSIONS_KEY, []);
/** Sesión válida y todos los permisos indicados. */
export const RequirePermissions = (...p: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, p);

export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => {
    const auth = ctx.switchToHttp().getRequest<Request>().auth;
    if (!auth) throw new Error('CurrentAuth used on a route without session');
    return auth;
  },
);

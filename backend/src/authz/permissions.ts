// Modelo de autorización: roles → permisos. Denegación predeterminada:
// una ruta sin @Public, @Authenticated o @RequirePermissions se rechaza.
export const ROLES = ['admin', 'editor', 'reader'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'documents:read',
  'documents:create',
  'documents:delete',
  'documents:favorite',
  'users:read',
  'users:manage',
  'audit:read',
  'reports:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  editor: [
    'documents:read',
    'documents:create',
    'documents:delete', // solo documentos propios (política por objeto)
    'documents:favorite',
  ],
  reader: ['documents:read', 'documents:favorite'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Clasificaciones documentales y nivel máximo visible por rol para
// documentos ajenos. "restricted" solo lo ven su propietario y admin.
export const CLASSIFICATIONS = [
  'internal',
  'confidential',
  'restricted',
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const ROLE_CLEARANCE: Record<Role, readonly Classification[]> = {
  admin: CLASSIFICATIONS,
  editor: ['internal', 'confidential'],
  reader: ['internal'],
};

export function canReadDocument(
  actor: { userId: string; role: Role },
  doc: { ownerId: string; classification: Classification },
): boolean {
  if (actor.role === 'admin' || doc.ownerId === actor.userId) return true;
  return ROLE_CLEARANCE[actor.role].includes(doc.classification);
}

export function canDeleteDocument(
  actor: { userId: string; role: Role },
  doc: { ownerId: string },
): boolean {
  if (!hasPermission(actor.role, 'documents:delete')) return false;
  return actor.role === 'admin' || doc.ownerId === actor.userId;
}

// Modelos de presentación. No constituyen cambios al contrato HTTP del equipo.
export type Role = 'Administrador' | 'Colaborador' | 'Lector';
export type Classification = 'Interno' | 'Confidencial' | 'Restringido';
export type DocumentItem = {
  id: string;
  title: string;
  filename: string;
  category: Classification;
  size: number;
  owner: string;
  updatedAt: string;
  favorite: boolean;
  source: 'fixture' | 'local';
};
export type AuditEvent = {
  id: string;
  action: string;
  resource: string;
  actor: string;
  at: string;
  result: 'Permitido' | 'Denegado';
};
export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mfa: boolean;
};

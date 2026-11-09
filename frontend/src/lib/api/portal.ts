export type User = {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'editor' | 'reader';
  status: 'active' | 'disabled';
  mfaEnabled: boolean;
  permissions: string[];
};
export type Session = {
  status: 'authenticated';
  user: User;
  csrfToken: string;
};
export type Challenge = {
  status: 'mfa_required';
  challengeId: string;
  expiresAt: string;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type DocumentRecord = {
  id: string;
  title: string;
  filename: string;
  classification: string;
  size: number;
  sha256: string;
  favorite: boolean;
  owner: { displayName: string };
  permissions: { canDelete: boolean; canDownload: boolean };
};
export type EventRecord = {
  id: string;
  occurredAt: string;
  action: string;
  outcome: string;
  actor: { email: string } | null;
};
export type Summary = {
  generatedAt: string;
  periodStart: string;
  documents: {
    total: number;
    totalBytes: number;
    byClassification: Record<string, number>;
  };
  users: { total: number; mfaEnabled: number; disabled: number };
  events: {
    byOutcome: Record<string, number>;
    failedLogins: number;
    integrityFailures: number;
  };
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  csrf?: string,
): Promise<T> {
  const base = (
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
  ).replace(/\/$/, '');
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (csrf) headers.set('X-CSRF-Token', csrf);
  const response = await fetch(base + path, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
    signal: options.signal ?? AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.code ?? '',
      body.message ?? 'La API no pudo completar la solicitud.',
      body.requestId,
    );
  }
  if (response.status === 204) return undefined as T;
  if (path.endsWith('/download')) return (await response.blob()) as T;
  if (response.headers.get('Content-Type')?.includes('application/json'))
    return response.json();
  throw new ApiError(
    502,
    'INVALID_RESPONSE',
    'La respuesta recibida no corresponde a la API.',
  );
}

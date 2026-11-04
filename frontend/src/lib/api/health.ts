export async function checkApiHealth(signal: AbortSignal): Promise<void> {
  const base =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const url = new URL(`${base.replace(/\/$/, '')}/health`);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Configuración de API no válida.');
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('La API no respondió correctamente.');
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !('status' in body) ||
    body.status !== 'ok' ||
    !('service' in body) ||
    body.service !== 'securedocs-api'
  )
    throw new Error('Respuesta de salud no reconocida.');
}

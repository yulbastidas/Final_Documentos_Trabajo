import type { NextConfig } from 'next';

// CSP: solo recursos del propio origen. El origen de la API se añade a
// connect-src porque en desarrollo directo la API corre en otro puerto.
// Next.js inserta scripts en línea para hidratar las páginas; por eso
// script-src conserva 'unsafe-inline' (una CSP con nonces exigiría renderizar
// todas las páginas de forma dinámica). En desarrollo, el recargado en
// caliente necesita 'unsafe-eval' y WebSocket.
const dev = process.env.NODE_ENV !== 'production';
let apiOrigin = '';
try {
  apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? '').origin;
} catch {
  apiOrigin = '';
}
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? ' ' + apiOrigin : ''}${dev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};
export default config;

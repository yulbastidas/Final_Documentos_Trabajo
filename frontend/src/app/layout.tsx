import type { Metadata } from 'next';
import './globals.css';
import './interface.css';
export const metadata: Metadata = {
  title: 'SecureDocs | Gestión documental segura',
  description:
    'Frontend universitario de gestión documental. Demostración con datos sintéticos e integración de seguridad pendiente.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

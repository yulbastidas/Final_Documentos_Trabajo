import type { Metadata } from 'next';
import './globals.css';
import './interface.css';
export const metadata: Metadata = {
  title: 'SecureDocs | Gestión documental segura',
  description:
    'Gestión documental segura: identidad con MFA, documentos cifrados y auditoría. Proyecto universitario con datos sintéticos.',
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

// Imprime claves nuevas para backend/.env. No escribe archivos.
// Uso: npm run keys:generate -w backend
import { randomBytes } from 'node:crypto';

const k = () => randomBytes(32).toString('base64');
console.log(
  '# Copiar a backend/.env (nunca al repositorio). Claves distintas por entorno.',
);
console.log('DOCUMENT_KEK_ID=k1');
console.log(`DOCUMENT_KEK=${k()}`);
console.log(`MFA_ENCRYPTION_KEY=${k()}`);
console.log(`CSRF_SECRET=${k()}`);

// La demostración con datos ficticios (/dashboard) solo existe en desarrollo.
// La imagen Docker la elimina y fija NEXT_PUBLIC_DEMO_ENABLED=false para que
// ningún enlace apunte a una ruta inexistente.
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_ENABLED !== 'false';

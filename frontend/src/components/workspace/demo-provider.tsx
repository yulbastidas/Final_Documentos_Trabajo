'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  initialDocuments,
  initialEvents,
  initialUsers,
} from '../../lib/fixtures';
import type {
  AuditEvent,
  Classification,
  DemoUser,
  DocumentItem,
  Role,
} from '../../lib/types';

type DemoContextType = {
  documents: DocumentItem[];
  events: AuditEvent[];
  users: DemoUser[];
  role: Role;
  setRole: (role: Role) => void;
  addDocument: (title: string, file: File, category: Classification) => void;
  removeDocument: (id: string) => void;
  toggleFavorite: (id: string) => void;
  changeUserRole: (id: string, role: Role) => void;
  reset: () => void;
};
const DemoContext = createContext<DemoContextType | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [events, setEvents] = useState(initialEvents);
  const [users, setUsers] = useState(initialUsers);
  const [role, setRole] = useState<Role>('Administrador');
  function record(action: string, resource: string) {
    setEvents((prev) => [
      {
        id: crypto.randomUUID(),
        action,
        resource,
        actor: 'Yuly Demo',
        at: new Date().toISOString(),
        result: 'Permitido',
      },
      ...prev,
    ]);
  }
  function addDocument(title: string, file: File, category: Classification) {
    if (role === 'Lector') return;
    // Guardar solo metadatos en memoria; nunca leer o transmitir el archivo.
    setDocuments((prev) => [
      {
        id: crypto.randomUUID(),
        title,
        filename: file.name,
        category,
        size: file.size,
        owner: 'Yuly Demo',
        updatedAt: new Date().toISOString(),
        favorite: false,
        source: 'local',
      },
      ...prev,
    ]);
    record('Metadatos añadidos (demo)', title);
  }
  function removeDocument(id: string) {
    if (role !== 'Administrador') return;
    const item = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (item) record('Registro eliminado (demo)', item.title);
  }
  function toggleFavorite(id: string) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d)),
    );
  }
  function changeUserRole(id: string, nextRole: Role) {
    if (role !== 'Administrador') return;
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: nextRole } : u)),
    );
    record(
      'Rol visual modificado (demo)',
      users.find((u) => u.id === id)?.name ?? 'Usuario demo',
    );
  }
  function reset() {
    setDocuments(initialDocuments);
    setEvents(initialEvents);
    setUsers(initialUsers);
    setRole('Administrador');
  }
  return (
    <DemoContext.Provider
      value={{
        documents,
        events,
        users,
        role,
        setRole,
        addDocument,
        removeDocument,
        toggleFavorite,
        changeUserRole,
        reset,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('Falta DemoProvider');
  return context;
}

import { createContext, useContext, type ReactNode } from 'react';
import type { ModMetadataDto } from '@/commands';

export const ModCatalogContext = createContext<Map<string, ModMetadataDto> | null>(null);

export function ModCatalogProvider({
  value,
  children,
}: {
  value: Map<string, ModMetadataDto>;
  children: ReactNode;
}) {
  return <ModCatalogContext.Provider value={value}>{children}</ModCatalogContext.Provider>;
}

export function useModCatalog(): Map<string, ModMetadataDto> {
  const value = useContext(ModCatalogContext);
  if (!value) throw new Error('Mod catalog requires ModCatalogProvider');
  return value;
}

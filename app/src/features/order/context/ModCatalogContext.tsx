import { createContext, useContext, type ReactNode } from 'react';
import type { ModMetadataDto } from '@/commands';

export const EMPTY_MOD_BY_PACKAGE_ID: Map<string, ModMetadataDto> = new Map();

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
  return useContext(ModCatalogContext) ?? EMPTY_MOD_BY_PACKAGE_ID;
}

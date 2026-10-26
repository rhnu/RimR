import type { OrderData } from '../context/workspace-types';
import { useAppConfig } from '@/queries/config';
import { useLibrary } from '@/queries/library';
import { useLoadActiveList } from '@/queries/game-config';
import { useCatalogSnapshot } from '@/queries/catalog';
import { needsSetup } from '@/domain/workspace/config';

export function useOrderData(): OrderData {
  const appConfig = useAppConfig();
  const setupComplete = appConfig.data != null && !needsSetup(appConfig.data);

  const scan = useCatalogSnapshot({ enabled: setupComplete });
  const activeList = useLoadActiveList({ enabled: scan.isSuccess });
  const library = useLibrary({ enabled: activeList.isSuccess });

  return { appConfig, scan, activeList, library };
}

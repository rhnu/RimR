import type { ModIdentityDto } from '@/commands';
import { diagnosticsForTargets, isSuppressed } from '@/domain/diagnostics/suppression';
import { useOrderWorkspaceData } from '@/features/order/context/hooks';
import { useOrderWorkspaceDerived } from '@/features/order/context/hooks';
import { DiagnosticIcon } from './rows/diagnostic-icon';

export function ModDiagnosticIcon({ identity }: { identity: ModIdentityDto }) {
  const { rawDiagnostics } = useOrderWorkspaceDerived();
  const { library } = useOrderWorkspaceData();
  const rules = library.data?.settings.diagnosticSuppressions ?? [];
  return (
    <DiagnosticIcon
      diagnostics={diagnosticsForTargets(rawDiagnostics, [identity]).filter(
        (diagnostic) => !isSuppressed(diagnostic, rules),
      )}
    />
  );
}

import type { DiagnosticDto, ModMetadataDto } from '@/commands';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DiagnosticReport } from './diagnostic-report';

export function ValidationDiagnosticList({
  diagnostics,
  modByPackageId,
}: {
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="pr-3">
        <DiagnosticReport diagnostics={diagnostics} modByPackageId={modByPackageId} showClean />
      </div>
    </ScrollArea>
  );
}

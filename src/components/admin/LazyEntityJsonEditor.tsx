import { lazy, Suspense } from "react";
import type { EntityType } from "@/types/entitySchema";

const EntityJsonEditor = lazy(() =>
  import("@/components/admin/EntityJsonEditor").then((m) => ({ default: m.EntityJsonEditor }))
);

const EditorFallback = () => (
  <div className="flex items-center justify-center py-12 text-muted-foreground">
    <span className="animate-pulse">Loading editor…</span>
  </div>
);

export interface LazyEntityJsonEditorProps {
  entityType: EntityType;
  entityId?: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  onValidationChange?: (isValid: boolean) => void;
  fileName?: string;
}

export function LazyEntityJsonEditor(props: LazyEntityJsonEditorProps) {
  return (
    <Suspense fallback={<EditorFallback />}>
      <EntityJsonEditor {...props} />
    </Suspense>
  );
}

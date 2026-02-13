import { lazy, Suspense } from "react";
import type { PageSection, SectionType } from "@/hooks/usePageSections";

const SectionJsonEditor = lazy(() =>
  import("@/components/admin/SectionJsonEditor").then((m) => ({ default: m.SectionJsonEditor }))
);

const EditorFallback = () => (
  <div className="flex items-center justify-center py-12 text-muted-foreground">
    <span className="animate-pulse">Loading editor…</span>
  </div>
);

export interface LazySectionJsonEditorProps {
  section: PageSection;
  sectionType: SectionType | undefined;
  onContentChange: (content: Record<string, unknown>) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export function LazySectionJsonEditor(props: LazySectionJsonEditorProps) {
  return (
    <Suspense fallback={<EditorFallback />}>
      <SectionJsonEditor {...props} />
    </Suspense>
  );
}

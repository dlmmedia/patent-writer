import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { PatentEditorClient } from "@/components/editor/patent-editor-client";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);
  if (!patent) notFound();

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 border-b px-6 py-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {patent.title}
        </h2>
        <p className="text-xs text-muted-foreground">
          Patent Editor &mdash; {patent.sections.length} sections
        </p>
      </div>
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <PatentEditorClient patent={patent as any} />
        </div>
      </div>
    </div>
  );
}

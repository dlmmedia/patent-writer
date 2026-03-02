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
    <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden">
      <PatentEditorClient patent={patent} />
    </div>
  );
}

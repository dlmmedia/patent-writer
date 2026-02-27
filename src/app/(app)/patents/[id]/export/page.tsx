import { getPatent, getPriorArtResults } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { ExportClient } from "@/components/export/export-client";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);

  if (!patent) {
    notFound();
  }

  const priorArtResults = await getPriorArtResults(id);

  return (
    <ExportClient
      patent={patent}
      priorArtResults={priorArtResults}
    />
  );
}

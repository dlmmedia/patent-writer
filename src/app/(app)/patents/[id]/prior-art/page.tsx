import { getPatent, getPriorArtResults, getLatestSearchMatrix } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { PriorArtClient } from "@/components/prior-art/prior-art-client";

export default async function PriorArtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);

  if (!patent) {
    notFound();
  }

  const existingResults = await getPriorArtResults(id);
  const latestMatrix = await getLatestSearchMatrix(id);

  return (
    <PriorArtClient
      patent={patent}
      initialResults={existingResults}
      initialMatrix={latestMatrix}
    />
  );
}

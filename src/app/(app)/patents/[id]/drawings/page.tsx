import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { DrawingStudioClient } from "@/components/drawings/drawing-studio-client";

export default async function DrawingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);
  if (!patent) notFound();

  return <DrawingStudioClient patent={patent} />;
}

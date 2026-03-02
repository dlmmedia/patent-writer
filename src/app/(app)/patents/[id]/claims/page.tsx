import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { ClaimsBuilderClient } from "@/components/claims/claims-builder-client";

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);
  if (!patent) notFound();

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden">
      <ClaimsBuilderClient patent={patent} />
    </div>
  );
}

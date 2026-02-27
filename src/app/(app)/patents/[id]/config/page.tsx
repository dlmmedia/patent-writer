import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { ConfigClient } from "@/components/config/config-client";

export default async function ConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);

  if (!patent) {
    notFound();
  }

  return <ConfigClient patent={patent} />;
}

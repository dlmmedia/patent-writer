import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PatentNav } from "./patent-nav";
import type { Jurisdiction } from "@/lib/types";
import { JURISDICTION_LABELS } from "@/lib/types";

const statusVariant: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  review:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ready_to_file:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  filed:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  abandoned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function PatentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const patent = await getPatent(id);
  if (!patent) notFound();

  const tabs = [
    { label: "Overview", href: `/patents/${id}` },
    { label: "Editor", href: `/patents/${id}/editor` },
    { label: "Claims", href: `/patents/${id}/claims` },
    { label: "Drawings", href: `/patents/${id}/drawings` },
    { label: "Prior Art", href: `/patents/${id}/prior-art` },
    { label: "Export", href: `/patents/${id}/export` },
    { label: "Config", href: `/patents/${id}/config` },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="heading-serif text-lg font-semibold truncate max-w-[500px]">
                {patent.title}
              </h1>
              <Badge className={statusVariant[patent.status] || ""}>
                {patent.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline">{patent.type.toUpperCase()}</Badge>
              <Badge variant="outline">
                {JURISDICTION_LABELS[
                  patent.jurisdiction as Jurisdiction
                ]?.split(" (")[0] || patent.jurisdiction}
              </Badge>
            </div>
          </div>
          <PatentNav tabs={tabs} />
        </div>
      </div>
      <div className="flex-1 relative min-h-0">{children}</div>
    </div>
  );
}

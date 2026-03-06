import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PatentNav } from "@/components/patent-nav";
import { PatentWorkspaceShell } from "@/components/patent-workspace-shell";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  review: "Under Review",
  ready_to_file: "Ready to File",
  filed: "Filed",
  abandoned: "Abandoned",
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

  if (!patent) {
    notFound();
  }

  const sectionCount = patent.sections?.length || 0;
  const completedSections = patent.sections?.filter((s) => s.plainText && s.plainText.length > 10).length || 0;
  const claimCount = patent.claims?.length || 0;
  const drawingCount = patent.drawings?.length || 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b px-6 py-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{patent.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{STATUS_LABELS[patent.status] || patent.status}</Badge>
              <Badge variant="secondary" className="text-xs capitalize">{patent.type}</Badge>
              <Badge variant="secondary" className="text-xs">{patent.jurisdiction}</Badge>
              <span className="text-xs text-muted-foreground">
                {completedSections}/{sectionCount} sections
              </span>
              <span className="text-xs text-muted-foreground">{claimCount} claims</span>
              <span className="text-xs text-muted-foreground">{drawingCount} drawings</span>
            </div>
          </div>
        </div>
        <PatentNav patentId={id} />
      </div>
      <PatentWorkspaceShell patentId={id}>
        {children}
      </PatentWorkspaceShell>
    </div>
  );
}

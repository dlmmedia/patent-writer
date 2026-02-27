import Link from "next/link";
import { getPatents } from "@/lib/actions/patents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { JURISDICTION_LABELS } from "@/lib/types";
import type { Jurisdiction } from "@/lib/types";

const statusVariant: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ready_to_file: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  filed: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  abandoned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusTopBorder: Record<string, string> = {
  draft: "border-t-2 border-t-muted-foreground/30",
  in_progress: "border-t-2 border-t-blue-400",
  review: "border-t-2 border-t-yellow-400",
  ready_to_file: "border-t-2 border-t-green-400",
  filed: "border-t-2 border-t-purple-400",
  abandoned: "border-t-2 border-t-red-400",
};

export default async function PatentsPage() {
  let patentsList: Awaited<ReturnType<typeof getPatents>> = [];
  try {
    patentsList = await getPatents();
  } catch {
    // DB not connected
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-serif text-3xl font-bold tracking-tight">Patents</h1>
          <p className="text-muted-foreground">
            Manage all your patent applications
          </p>
        </div>
        <Link href="/patents/new">
          <Button className="gap-2 btn-press legal-gradient text-white hover:opacity-90 shadow-sm">
            <Plus className="h-4 w-4" />
            New Patent
          </Button>
        </Link>
      </div>

      {patentsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="heading-serif text-xl font-semibold mb-2">No patents yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create your first patent application using the AI-assisted wizard
              to get started.
            </p>
            <Link href="/patents/new">
              <Button size="lg" className="gap-2 btn-press legal-gradient text-white hover:opacity-90">
                <Plus className="h-5 w-5" />
                Create Your First Patent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patentsList.map((patent) => (
            <Link key={patent.id} href={`/patents/${patent.id}`}>
              <Card className={`card-hover h-full ${statusTopBorder[patent.status] || ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2 leading-snug">
                      {patent.title}
                    </CardTitle>
                    <Badge
                      className={`shrink-0 text-[10px] px-2 py-0.5 ${statusVariant[patent.status] || ""}`}
                    >
                      {patent.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {patent.type.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {JURISDICTION_LABELS[patent.jurisdiction as Jurisdiction]?.split(" (")[0] || patent.jurisdiction}
                    </Badge>
                  </div>
                  {patent.technologyArea && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                      {patent.technologyArea}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Updated{" "}
                    {new Date(patent.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

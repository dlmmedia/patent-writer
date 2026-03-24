import Link from "next/link";
import { Plus, FileText, Clock, CheckCircle2, PenLine, ArrowRight, ExternalLink, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/actions/patents";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  review: { label: "Review", variant: "outline" },
  ready_to_file: { label: "Ready", variant: "default" },
  filed: { label: "Filed", variant: "default" },
  abandoned: { label: "Abandoned", variant: "destructive" },
};

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your patent portfolio
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link href="/patents/new">
            <Plus className="h-5 w-5" />
            New Patent
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Patents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">In your portfolio</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PenLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently drafting</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ready to File</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.readyToFile}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting filing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.drafts}</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet started</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 shrink-0">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">USPTO Account</p>
            <p className="text-xs text-muted-foreground">
              Sign in to access prior art search results and view patent documents on USPTO
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
            <a href="https://account.uspto.gov" target="_blank" rel="noopener noreferrer">
              Sign in to USPTO
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Patents</CardTitle>
              <CardDescription>Your most recently updated patent applications</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link href="/patents">
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">No patents yet</p>
                <p className="text-sm text-muted-foreground">Create your first patent to get started.</p>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/patents/new">
                  <Plus className="h-4 w-4" />
                  Create Patent
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recent.map((patent) => {
                const statusConfig = STATUS_CONFIG[patent.status] || STATUS_CONFIG.draft;
                return (
                  <Link
                    key={patent.id}
                    href={`/patents/${patent.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {patent.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={statusConfig.variant} className="text-xs">
                          {statusConfig.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{patent.type}</span>
                        <span className="text-xs text-muted-foreground">{patent.jurisdiction}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-4">
                      {new Date(patent.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

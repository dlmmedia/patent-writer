import Link from "next/link";
import { getDashboardStats } from "@/lib/actions/patents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  PenLine,
  CheckCircle,
  Clock,
  Plus,
  ArrowRight,
  Scale,
  Sparkles,
} from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ready_to_file: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  filed: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  abandoned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statAccents = [
  "border-l-4 border-l-[oklch(0.27_0.05_260)]",
  "border-l-4 border-l-[oklch(0.72_0.12_85)]",
  "border-l-4 border-l-[oklch(0.55_0.15_260)]",
  "border-l-4 border-l-[oklch(0.55_0.18_145)]",
];

export default async function DashboardPage() {
  let stats = { total: 0, drafts: 0, inProgress: 0, readyToFile: 0, recent: [] as Awaited<ReturnType<typeof getDashboardStats>>["recent"] };
  try {
    stats = await getDashboardStats();
  } catch {
    // DB not connected yet — show empty state
  }

  const statCards = [
    { title: "Total Patents", value: stats.total, icon: FileText, href: "/patents" },
    { title: "Drafts", value: stats.drafts, icon: PenLine, href: "/patents?status=draft" },
    { title: "In Progress", value: stats.inProgress, icon: Clock, href: "/patents?status=in_progress" },
    { title: "Ready to File", value: stats.readyToFile, icon: CheckCircle, href: "/patents?status=ready_to_file" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl legal-gradient p-6 text-white">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="heading-serif text-2xl font-bold tracking-tight">
              Patent Portfolio
            </h1>
            <p className="text-white/75 mt-1 text-sm">
              Manage, draft, and file your intellectual property with AI assistance
            </p>
          </div>
          <Link href="/patents/new">
            <Button size="lg" className="gap-2 bg-white/15 text-white border border-white/20 hover:bg-white/25 btn-press backdrop-blur-sm">
              <Plus className="h-5 w-5" />
              New Patent
            </Button>
          </Link>
        </div>
        <Scale className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Link key={stat.title} href={stat.href}>
            <Card className={`card-hover ${statAccents[i]} overflow-hidden`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground/60" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="heading-serif text-lg">Recent Patents</CardTitle>
          <Link href="/patents">
            <Button variant="ghost" size="sm" className="gap-1 btn-press">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="heading-serif text-lg font-semibold">No patents yet</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Create your first patent application to get started
              </p>
              <Link href="/patents/new">
                <Button className="gap-2 btn-press legal-gradient text-white hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  Create Patent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {stats.recent.map((patent) => (
                <Link
                  key={patent.id}
                  href={`/patents/${patent.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">
                      {patent.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {patent.type.toUpperCase()} &middot; {patent.jurisdiction}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[patent.status] || ""}>
                      {patent.status.replace(/_/g, " ")}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

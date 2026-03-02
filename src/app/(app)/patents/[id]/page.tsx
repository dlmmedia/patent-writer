import Link from "next/link";
import { getPatent } from "@/lib/actions/patents";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SECTION_LABELS, JURISDICTION_LABELS } from "@/lib/types";
import type { Jurisdiction, SectionType } from "@/lib/types";
import {
  FileText,
  Scale,
  Image,
  Download,
  Pencil,
  Users,
  Globe,
  Cpu,
  CheckCircle2,
  Circle,
} from "lucide-react";

export default async function PatentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);
  if (!patent) notFound();

  const totalSections = patent.sections.length;
  const completedSections = patent.sections.filter(
    (s) => s.plainText && s.plainText.trim().length > 0
  ).length;
  const completionPercent =
    totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const totalWords = patent.sections.reduce(
    (sum, s) => sum + (s.wordCount ?? 0),
    0
  );

  const independentClaims = patent.claims.filter((c) => c.isIndependent);
  const dependentClaims = patent.claims.filter((c) => !c.isIndependent);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sections</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {completedSections}/{totalSections}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completionPercent}% complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Claims</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{patent.claims.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {independentClaims.length} independent
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {dependentClaims.length} dependent
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drawings</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {patent.drawings.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {patent.referenceNumerals.length} reference numerals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Word Count</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {totalWords.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across all sections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sections + Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <CardDescription>
              Content status for each patent section
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patent.sections.map((section) => {
                const hasContent =
                  section.plainText && section.plainText.trim().length > 0;
                return (
                  <div
                    key={section.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {hasContent ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm truncate">
                        {SECTION_LABELS[section.sectionType as SectionType] ??
                          section.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {section.isAiGenerated && (
                        <Badge variant="secondary" className="text-xs">
                          AI
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {section.wordCount ?? 0} words
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patent Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={Globe} label="Jurisdiction">
                {JURISDICTION_LABELS[patent.jurisdiction as Jurisdiction] ??
                  patent.jurisdiction}
              </DetailRow>
              <DetailRow icon={FileText} label="Type">
                {patent.type.charAt(0).toUpperCase() + patent.type.slice(1)}
              </DetailRow>
              <DetailRow icon={Scale} label="Entity Size">
                {patent.entitySize
                  ? patent.entitySize.charAt(0).toUpperCase() +
                    patent.entitySize.slice(1)
                  : "Not set"}
              </DetailRow>
              {patent.technologyArea && (
                <DetailRow icon={Cpu} label="Technology">
                  {patent.technologyArea}
                </DetailRow>
              )}
              {Array.isArray(patent.inventors) &&
                patent.inventors.length > 0 && (
                  <DetailRow icon={Users} label="Inventors">
                    {(
                      patent.inventors as { name: string; address?: string }[]
                    )
                      .map((inv) => inv.name)
                      .join(", ")}
                  </DetailRow>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href={`/patents/${id}/editor`}>
                <Button variant="outline" className="w-full gap-2" size="sm">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Link href={`/patents/${id}/claims`}>
                <Button variant="outline" className="w-full gap-2" size="sm">
                  <Scale className="h-4 w-4" />
                  Claims
                </Button>
              </Link>
              <Link href={`/patents/${id}/drawings`}>
                <Button variant="outline" className="w-full gap-2" size="sm">
                  <Image className="h-4 w-4" />
                  Drawings
                </Button>
              </Link>
              <Link href={`/patents/${id}/export`}>
                <Button variant="outline" className="w-full gap-2" size="sm">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Claims Preview */}
      {patent.claims.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Claims
                </CardTitle>
                <CardDescription>
                  {independentClaims.length} independent, {dependentClaims.length} dependent
                </CardDescription>
              </div>
              <Link href={`/patents/${id}/claims`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Claims
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patent.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex gap-3 rounded-md border p-3"
                >
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <span className="text-sm font-mono font-bold tabular-nums">
                      {claim.claimNumber}.
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={claim.isIndependent ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {claim.isIndependent ? "Independent" : "Dependent"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {(claim.claimType as string).replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 break-words">
                      {claim.fullText || (
                        <span className="italic">No claim text</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-medium">{children}</p>
      </div>
    </div>
  );
}

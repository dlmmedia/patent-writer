import Link from "next/link";
import { getPatent, getPriorArtResults } from "@/lib/actions/patents";
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
import type { Jurisdiction, SectionType, PatentWithRelations } from "@/lib/types";
import type { Inventor, RelatedApplication, IntakeQA } from "@/lib/db/schema";
import { getINIDFields, getDocumentStats, formatInventorName } from "@/lib/patent/inid-codes";
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
  AlertTriangle,
  Hash,
  Shield,
  MessageSquare,
  Link2,
  ClipboardCheck,
  Settings2,
} from "lucide-react";

const SECTION_WORD_TARGETS: Partial<Record<SectionType, number>> = {
  field_of_invention: 50,
  background: 300,
  summary: 300,
  brief_description_drawings: 100,
  detailed_description: 1500,
  claims: 200,
  abstract: 50,
};

function getSectionCompleteness(sectionType: SectionType, wordCount: number): {
  percent: number;
  status: "empty" | "partial" | "good" | "complete";
} {
  const target = SECTION_WORD_TARGETS[sectionType];
  if (!target) return { percent: wordCount > 0 ? 100 : 0, status: wordCount > 0 ? "complete" : "empty" };
  const pct = Math.min(100, Math.round((wordCount / target) * 100));
  if (pct === 0) return { percent: 0, status: "empty" };
  if (pct < 50) return { percent: pct, status: "partial" };
  if (pct < 100) return { percent: pct, status: "good" };
  return { percent: 100, status: "complete" };
}

export default async function PatentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patent = await getPatent(id);
  if (!patent) notFound();

  const priorArt = await getPriorArtResults(id);

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

  const inventors = (patent.inventors as Inventor[] | null) || [];
  const relatedApps = (patent.relatedApplications as RelatedApplication[] | null) || [];
  const intakeResponses = (patent.intakeResponses as IntakeQA[] | null) || [];
  const inidFields = getINIDFields(patent as PatentWithRelations);
  const docStats = getDocumentStats(patent as PatentWithRelations);

  // Filing readiness checklist
  const checklist = [
    { label: "Title provided", done: patent.title.length > 5, critical: true },
    { label: "At least one inventor", done: inventors.length > 0, critical: true },
    { label: "Invention description", done: !!patent.inventionDescription, critical: true },
    { label: "All sections drafted", done: completionPercent === 100, critical: true },
    { label: "Claims written", done: patent.claims.length > 0, critical: patent.type !== "provisional" },
    { label: "Drawings attached", done: patent.drawings.length > 0, critical: false },
    { label: "CPC codes assigned", done: Array.isArray(patent.cpcCodes) && (patent.cpcCodes as string[]).length > 0, critical: false },
    { label: "Prior art searched", done: priorArt.length > 0, critical: false },
    { label: "AI interview completed", done: patent.intakeCompleted || false, critical: false },
    { label: "Correspondence address", done: !!patent.correspondenceAddress, critical: false },
  ];
  const criticalDone = checklist.filter((c) => c.critical && c.done).length;
  const criticalTotal = checklist.filter((c) => c.critical).length;
  const filingReady = criticalDone === criticalTotal;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
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
              ~{docStats.specificationPages} pages
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filing Readiness + INID Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Filing Readiness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Filing Readiness
            </CardTitle>
            <CardDescription>
              {filingReady
                ? "All critical items are complete. Ready to file!"
                : `${criticalDone}/${criticalTotal} critical items complete`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : item.critical ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={item.done ? "" : "text-muted-foreground"}>
                  {item.label}
                </span>
                {item.critical && !item.done && (
                  <Badge variant="destructive" className="text-[10px] ml-auto">Required</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* INID Bibliographic Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4" />
              Bibliographic Data (INID)
            </CardTitle>
            <CardDescription>
              Standardized bibliographic field codes for the front page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {inidFields.filter((f) => f.code !== "(57)").slice(0, 12).map((field) => {
              const displayValue = Array.isArray(field.value)
                ? (field.value as string[]).join("; ")
                : (field.value as string);
              if (!displayValue) return null;
              return (
                <div key={field.code} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0 mt-0.5">{field.code}</Badge>
                  <div className="min-w-0">
                    <span className="text-muted-foreground text-xs">{field.label}: </span>
                    <span className="text-xs break-words">{displayValue.length > 80 ? displayValue.slice(0, 80) + "..." : displayValue}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Sections with completeness indicators */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <CardDescription>
              Content status and completeness for each section
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patent.sections.map((section) => {
                const hasContent =
                  section.plainText && section.plainText.trim().length > 0;
                const wc = section.wordCount ?? 0;
                const comp = getSectionCompleteness(section.sectionType as SectionType, wc);
                const target = SECTION_WORD_TARGETS[section.sectionType as SectionType];
                return (
                  <div key={section.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {comp.status === "complete" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : comp.status === "good" ? (
                          <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                        ) : comp.status === "partial" ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
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
                          <Badge variant="secondary" className="text-xs">AI</Badge>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {wc}{target ? `/${target}` : ""} words
                        </span>
                      </div>
                    </div>
                    {target && hasContent && (
                      <Progress
                        value={comp.percent}
                        className="h-1 ml-6"
                      />
                    )}
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
              {patent.docketNumber && (
                <DetailRow icon={Hash} label="Docket No.">
                  {patent.docketNumber}
                </DetailRow>
              )}
              {inventors.length > 0 && (
                <DetailRow icon={Users} label="Inventors">
                  {inventors.map((inv) => formatInventorName(inv)).join(", ")}
                </DetailRow>
              )}
              {relatedApps.length > 0 && (
                <DetailRow icon={Link2} label="Related Apps">
                  {relatedApps.length} application(s)
                </DetailRow>
              )}
              {intakeResponses.length > 0 && (
                <DetailRow icon={MessageSquare} label="AI Interview">
                  {intakeResponses.length} responses
                </DetailRow>
              )}
              {priorArt.length > 0 && (
                <DetailRow icon={Shield} label="Prior Art">
                  {priorArt.length} references found
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
              <Link href={`/patents/${id}/config`} className="col-span-2">
                <Button variant="outline" className="w-full gap-2" size="sm">
                  <Settings2 className="h-4 w-4" />
                  Configuration
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

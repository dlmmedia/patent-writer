"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  FileText,
  FileDown,
  Package,
  Shield,
  Check,
  X,
  AlertTriangle,
  Download,
  Loader2,
  Wand2,
  Scale,
  Search,
  Tag,
  Grid3X3,
} from "lucide-react";
import JSZip from "jszip";
import type {
  PatentWithRelations,
  PriorArtResult,
  SectionType,
} from "@/lib/types";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/types";
import { toast } from "sonner";

interface ExportClientProps {
  patent: PatentWithRelations;
  priorArtResults: PriorArtResult[];
}

interface ExportOptions {
  includeParagraphNumbers: boolean;
  includeHeadersFooters: boolean;
  pageSize: "letter" | "a4";
  fontSize: number;
}

type SectionStatus = {
  type: SectionType;
  label: string;
  complete: boolean;
  wordCount: number;
};

function getSectionStatuses(patent: PatentWithRelations): SectionStatus[] {
  return SECTION_ORDER
    .filter((type) => type !== "claims")
    .map((type) => {
      const section = patent.sections.find((s) => s.sectionType === type);
      const hasContent = !!section?.plainText?.trim();
      return {
        type,
        label: SECTION_LABELS[type],
        complete: hasContent,
        wordCount: section?.wordCount || 0,
      };
    });
}

function getCompleteness(patent: PatentWithRelations): number {
  const statuses = getSectionStatuses(patent);
  const completedSections = statuses.filter((s) => s.complete).length;
  const hasClaims = patent.claims.length > 0;
  const total = statuses.length + 1;
  const completed = completedSections + (hasClaims ? 1 : 0);
  return Math.round((completed / total) * 100);
}

const CRITICAL_SECTIONS: SectionType[] = [
  "abstract",
  "detailed_description",
  "summary",
];

export function ExportClient({ patent, priorArtResults }: ExportClientProps) {
  const [options, setOptions] = useState<ExportOptions>({
    includeParagraphNumbers: true,
    includeHeadersFooters: true,
    pageSize: "letter",
    fontSize: 12,
  });
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingUsptoPdf, setDownloadingUsptoPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingCoverSheet, setDownloadingCoverSheet] = useState(false);
  const [downloadingFilingPackage, setDownloadingFilingPackage] = useState(false);
  const [generatingMissing, setGeneratingMissing] = useState(false);

  const sectionStatuses = getSectionStatuses(patent);
  const completeness = getCompleteness(patent);
  const idsCount = priorArtResults.filter((r) => r.addedToIds).length;

  const missingSections = sectionStatuses.filter((s) => !s.complete);
  const missingCritical = missingSections.filter((s) =>
    CRITICAL_SECTIONS.includes(s.type)
  );

  function buildExportUrl(format: "pdf" | "docx"): string {
    const params = new URLSearchParams({ patentId: patent.id });
    params.set("pageSize", options.pageSize);
    params.set("fontSize", String(options.fontSize));
    if (!options.includeParagraphNumbers)
      params.set("paragraphNumbering", "false");
    if (!options.includeHeadersFooters)
      params.set("headersFooters", "false");
    return `/api/export/${format}?${params.toString()}`;
  }

  async function handleDownload(
    format: "pdf" | "docx",
    setLoading: (v: boolean) => void
  ) {
    setLoading(true);
    try {
      const res = await fetch(buildExportUrl(format));
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      console.error(`Failed to download ${format}:`, err);
      toast.error(`Failed to download ${format.toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadIds() {
    setDownloadingIds(true);
    try {
      const res = await fetch(`/api/export/ids?patentId=${patent.id}`);
      if (!res.ok) throw new Error("IDS generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_IDS.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("IDS downloaded");
    } catch (err) {
      console.error("Failed to download IDS:", err);
      toast.error("Failed to download IDS");
    } finally {
      setDownloadingIds(false);
    }
  }

  async function handleDownloadDrawings() {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("drawings")!;

      await Promise.all(
        patent.drawings.map(async (drawing) => {
          const urls = [
            { url: drawing.originalUrl, prefix: "original" },
            { url: drawing.processedUrl, prefix: "processed" },
          ];

          for (const { url, prefix } of urls) {
            if (!url) continue;
            try {
              const res = await fetch(url);
              if (!res.ok) continue;
              const blob = await res.blob();
              const ext = url.split(".").pop()?.split("?")[0] || "png";
              folder.file(
                `${prefix}_fig_${drawing.figureNumber}.${ext}`,
                blob
              );
            } catch {
              // skip unreachable images
            }
          }
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Drawings.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Drawings downloaded");
    } catch (err) {
      console.error("Failed to download drawings:", err);
      toast.error("Failed to download drawings");
    } finally {
      setDownloadingZip(false);
    }
  }

  async function handleDownloadUsptoPdf() {
    setDownloadingUsptoPdf(true);
    try {
      const params = new URLSearchParams({ patentId: patent.id });
      params.set("pageSize", options.pageSize);
      if (!options.includeParagraphNumbers)
        params.set("paragraphNumbering", "false");
      const res = await fetch(`/api/export/uspto-pdf?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_USPTO_Patent.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("USPTO Patent PDF downloaded");
    } catch (err: any) {
      console.error("Failed to download USPTO PDF:", err);
      toast.error(err?.message || "Failed to generate USPTO Patent PDF");
    } finally {
      setDownloadingUsptoPdf(false);
    }
  }

  async function handleGenerateMissing() {
    setGeneratingMissing(true);
    try {
      const res = await fetch("/api/ai/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patentId: patent.id,
          model: "gemini-3.1-pro",
          skipExisting: true,
          generateFigures: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      toast.success(
        "Missing sections generated. Reload to see updated content."
      );
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate missing sections");
    } finally {
      setGeneratingMissing(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export
        </h2>
        <p className="text-muted-foreground">
          Export your patent application in various formats
        </p>
      </div>

      {/* Completeness Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {completeness === 100 ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            Patent Completeness
          </CardTitle>
          <CardDescription>
            {completeness === 100
              ? "All sections are complete — ready to export"
              : "Some sections are incomplete. You can still export, but the document may have gaps."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Progress value={completeness} className="flex-1" />
            <span className="text-sm font-medium tabular-nums w-10 text-right">
              {completeness}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sectionStatuses.map((s) => (
              <div
                key={s.type}
                className="flex items-center gap-2 text-sm py-1"
              >
                {s.complete ? (
                  <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                )}
                <span className={s.complete ? "" : "text-muted-foreground"}>
                  {s.label}
                </span>
                {s.complete && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {s.wordCount} words
                  </Badge>
                )}
                {!s.complete && CRITICAL_SECTIONS.includes(s.type) && (
                  <Badge
                    variant="destructive"
                    className="ml-auto text-xs"
                  >
                    Required
                  </Badge>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm py-1">
              {patent.claims.length > 0 ? (
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              )}
              <span
                className={
                  patent.claims.length > 0 ? "" : "text-muted-foreground"
                }
              >
                Claims
              </span>
              {patent.claims.length > 0 ? (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {patent.claims.length} claims
                </Badge>
              ) : (
                <Badge variant="destructive" className="ml-auto text-xs">
                  Required
                </Badge>
              )}
            </div>
          </div>

          {/* Generate Missing Sections */}
          {missingSections.length > 0 && (
            <div className="pt-2">
              {missingCritical.length > 0 && (
                <p className="text-xs text-destructive mb-2">
                  Missing critical sections:{" "}
                  {missingCritical.map((s) => s.label).join(", ")}
                </p>
              )}
              <Button
                onClick={handleGenerateMissing}
                disabled={generatingMissing}
                variant="outline"
                className="gap-2"
              >
                {generatingMissing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {generatingMissing
                  ? "Generating..."
                  : `Generate ${missingSections.length} Missing Section${missingSections.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
            <div className="flex items-center gap-2">
              <Checkbox
                id="paragraphNumbers"
                checked={options.includeParagraphNumbers}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeParagraphNumbers: !!checked,
                  }))
                }
              />
              <Label
                htmlFor="paragraphNumbers"
                className="text-sm cursor-pointer"
              >
                Include paragraph numbers
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="headersFooters"
                checked={options.includeHeadersFooters}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({
                    ...o,
                    includeHeadersFooters: !!checked,
                  }))
                }
              />
              <Label
                htmlFor="headersFooters"
                className="text-sm cursor-pointer"
              >
                Include headers & footers
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-sm whitespace-nowrap">
                Page Size
              </Label>
              <Select
                value={options.pageSize}
                onValueChange={(v) =>
                  setOptions((o) => ({
                    ...o,
                    pageSize: v as "letter" | "a4",
                  }))
                }
              >
                <SelectTrigger id="pageSize" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="fontSize" className="text-sm whitespace-nowrap">
                Font Size
              </Label>
              <Select
                value={String(options.fontSize)}
                onValueChange={(v) =>
                  setOptions((o) => ({
                    ...o,
                    fontSize: parseInt(v, 10),
                  }))
                }
              >
                <SelectTrigger id="fontSize" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10pt</SelectItem>
                  <SelectItem value="11">11pt</SelectItem>
                  <SelectItem value="12">12pt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* USPTO Patent Format PDF */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-amber-600" />
            USPTO Patent Format PDF
            <Badge variant="secondary" className="text-xs">Professional</Badge>
          </CardTitle>
          <CardDescription>
            Authentic USPTO granted-patent layout with two-column specification,
            INID-coded cover page with barcode, drawing sheets, and proper
            column/line formatting matching real US patent documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={handleDownloadUsptoPdf}
            disabled={downloadingUsptoPdf}
          >
            {downloadingUsptoPdf ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            {downloadingUsptoPdf ? "Generating USPTO PDF..." : "Download USPTO Patent PDF"}
          </Button>
        </CardContent>
      </Card>

      {/* Export Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* PDF Export */}
        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-red-500" />
              Simple PDF
            </CardTitle>
            <CardDescription>
              Single-column PDF with proper margins, font sizing, and section
              formatting. Ready for electronic filing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handleDownload("pdf", setDownloadingPdf)}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {downloadingPdf ? "Generating PDF..." : "Download Simple PDF"}
            </Button>
          </CardContent>
        </Card>

        {/* DOCX Export */}
        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-blue-500" />
              DOCX Document
            </CardTitle>
            <CardDescription>
              Editable Word document with all sections, proper headings, and
              paragraph numbering. Ideal for attorney review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handleDownload("docx", setDownloadingDocx)}
              disabled={downloadingDocx}
            >
              {downloadingDocx ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {downloadingDocx ? "Generating DOCX..." : "Download DOCX"}
            </Button>
          </CardContent>
        </Card>

        {/* Drawing Package */}
        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-purple-500" />
              Drawing Package
            </CardTitle>
            <CardDescription>
              All patent drawings as a ZIP archive. Includes original and
              processed versions at 300 DPI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              disabled={patent.drawings.length === 0 || downloadingZip}
              onClick={handleDownloadDrawings}
            >
              {downloadingZip ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              {patent.drawings.length === 0
                ? "No Drawings Available"
                : downloadingZip
                  ? "Creating ZIP..."
                  : `Download ZIP (${patent.drawings.length} drawings)`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cover Sheet & Filing Package */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-amber-500" />
              PTO/SB/16 Cover Sheet
            </CardTitle>
            <CardDescription>
              Official USPTO Provisional Application Cover Sheet with inventor data,
              correspondence address, entity size, and fee calculation auto-filled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              disabled={downloadingCoverSheet}
              onClick={async () => {
                setDownloadingCoverSheet(true);
                try {
                  const res = await fetch(`/api/export/cover-sheet?patentId=${patent.id}`);
                  if (!res.ok) throw new Error("Failed");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `PTO-SB-16_Cover_Sheet.docx`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success("Cover sheet downloaded");
                } catch {
                  toast.error("Failed to download cover sheet");
                } finally {
                  setDownloadingCoverSheet(false);
                }
              }}
            >
              {downloadingCoverSheet ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {downloadingCoverSheet ? "Generating..." : "Download Cover Sheet"}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-emerald-600" />
              Complete Filing Package
            </CardTitle>
            <CardDescription>
              ZIP containing: Specification DOCX, PTO/SB/16 Cover Sheet, IDS (if
              prior art exists), Drawings, and Fee Worksheet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={downloadingFilingPackage}
              onClick={async () => {
                setDownloadingFilingPackage(true);
                try {
                  const res = await fetch(`/api/export/filing-package?patentId=${patent.id}`);
                  if (!res.ok) throw new Error("Failed");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Filing_Package_${patent.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success("Filing package downloaded");
                } catch {
                  toast.error("Failed to generate filing package");
                } finally {
                  setDownloadingFilingPackage(false);
                }
              }}
            >
              {downloadingFilingPackage ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              {downloadingFilingPackage ? "Building Package..." : "Download Filing Package (ZIP)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* IDS Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-emerald-500" />
            Information Disclosure Statement (IDS)
          </CardTitle>
          <CardDescription>
            Generate an IDS from prior art results that have been marked for
            disclosure. The IDS includes tables for U.S. patents, foreign
            patents, and non-patent literature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  Prior Art References
                </span>
                <Badge variant="secondary">{priorArtResults.length} total</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {idsCount > 0
                  ? `${idsCount} reference${idsCount === 1 ? "" : "s"} marked for IDS disclosure`
                  : "No references marked for IDS. Mark references in the Prior Art tab."}
              </p>
            </div>
            <Button
              onClick={handleDownloadIds}
              disabled={idsCount === 0 || downloadingIds}
            >
              {downloadingIds ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {downloadingIds ? "Generating..." : "Generate IDS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Research Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-indigo-500" />
            Research Documents
          </CardTitle>
          <CardDescription>
            Download documents that show how prior art search decisions were made,
            including the CPC search matrix, keyword analysis, and full prior art report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium">CPC Search Matrix</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Structured table mapping CPC codes to search keywords, starter queries,
                and a recommended 3-pass search workflow.
              </p>
              <a
                href={`/api/export/search-matrix?patentId=${patent.id}`}
                download
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  Download Search Matrix
                </Button>
              </a>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Prior Art Report</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Comprehensive report with executive summary, search methodology,
                results table, AI analysis, and IDS candidates.
              </p>
              <a
                href={`/api/export/prior-art-report?patentId=${patent.id}`}
                download
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  Download Prior Art Report
                </Button>
              </a>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Keyword Analysis</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Keyword groups, substitute terms, CPC code analysis, and suggested
                search strings used for prior art discovery.
              </p>
              <a
                href={`/api/export/keyword-report?patentId=${patent.id}`}
                download
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  Download Keyword Analysis
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useMutation } from "@tanstack/react-query";
import type { Patent, PriorArtResult, PriorArtSearchMatrix, RiskLevel } from "@/lib/types";
import {
  savePriorArtSearch,
  savePriorArtResults,
  togglePriorArtIDS,
  saveSearchMatrix,
} from "@/lib/actions/patents";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  ExternalLink,
  AlertTriangle,
  Shield,
  FileText,
  Plus,
  Filter,
  Loader2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  ImageIcon,
  Sparkles,
  Grid3X3,
  Tag,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface KeywordGroup {
  category: string;
  description: string;
  keywords: string[];
}

interface SearchMatrixEntry {
  cpcCode: string;
  plainEnglishFocus: string;
  keywords: string[];
  starterQueries: string[];
  relevanceRanking: number;
  reclassificationNotes?: string;
}

interface SearchMatrixData {
  cpcEntries: SearchMatrixEntry[];
  combinedQueries: { description: string; queryString: string }[];
  searchWorkflow: {
    passes: {
      step: number;
      name: string;
      description: string;
      whatToLookFor: string;
      queries: string[];
    }[];
  };
  strongestTerms: {
    structureTerms: string[];
    conversionTerms: string[];
    cleanupTerms: string[];
    inputFormatTerms: string[];
  };
  priorArtRiskAreas: {
    area: string;
    description: string;
    likelyCpcCodes: string[];
  }[];
}

interface SearchApiResult {
  id: string;
  patentNumber: string;
  title: string;
  abstract: string;
  assignee: string;
  filingDate: string;
  sourceApi: string;
  externalUrl: string;
}

interface Analysis {
  riskLevel: RiskLevel;
  relevanceScore: number;
  analysis: string;
  overlappingElements: string[];
  differentiatingFeatures: string[];
  recommendation: string;
}

interface PatentViewData {
  title: string;
  abstract: string;
  description: string;
  claims: string[];
  images: { url: string; label: string }[];
  filingDate: string;
  inventors: string[];
  assignee: string;
  patentNumber: string;
}

interface DisplayResult extends SearchApiResult {
  riskLevel?: RiskLevel;
  relevanceScore?: number;
  analysis?: Analysis;
  addedToIds: boolean;
  analysing?: boolean;
  viewData?: PatentViewData;
}

interface PriorArtClientProps {
  patent: Patent & {
    sections: { id: string; sectionType: string; plainText: string | null }[];
    claims: { id: string; fullText: string }[];
  };
  initialResults: PriorArtResult[];
  initialMatrix?: PriorArtSearchMatrix | null;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  high: {
    label: "High Risk",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  medium: {
    label: "Medium",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  low: {
    label: "Low",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  patentsview: "USPTO / PatentsView",
  epo: "EPO OPS",
};

function buildClaimText(patent: PriorArtClientProps["patent"]): string {
  if (patent.claims.length > 0) {
    return patent.claims.map((c) => c.fullText).join("\n\n");
  }
  const abstract = patent.sections.find((s) => s.sectionType === "abstract");
  return abstract?.plainText || patent.title;
}

export function PriorArtClient({
  patent,
  initialResults,
  initialMatrix,
}: PriorArtClientProps) {
  const [query, setQuery] = React.useState("");
  const [sourcePatentsView, setSourcePatentsView] = React.useState(true);
  const [sourceEpo, setSourceEpo] = React.useState(true);
  const [results, setResults] = React.useState<DisplayResult[]>(() =>
    initialResults.map((r) => ({
      id: r.id,
      patentNumber: r.externalPatentNumber || "",
      title: r.title,
      abstract: r.abstract || "",
      assignee: r.assignee || "",
      filingDate: r.filingDate || "",
      sourceApi: r.sourceApi,
      externalUrl: r.externalUrl || "",
      riskLevel: r.riskLevel as RiskLevel | undefined,
      relevanceScore: r.relevanceScore ?? undefined,
      addedToIds: r.addedToIds ?? false,
      analysis: r.aiAnalysis
        ? {
            riskLevel: (r.riskLevel as RiskLevel) || "low",
            relevanceScore: r.relevanceScore ?? 0,
            analysis: r.aiAnalysis,
            overlappingElements: [],
            differentiatingFeatures: [],
            recommendation: "",
          }
        : undefined,
    }))
  );
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = React.useState<string[]>([]);
  const [selectedResult, setSelectedResult] =
    React.useState<DisplayResult | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetMode, setSheetMode] = React.useState<"view" | "analysis">(
    "view"
  );
  const [viewLoading, setViewLoading] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");

  // Keyword groups & CPC filters
  const [keywordGroups, setKeywordGroups] = React.useState<KeywordGroup[]>([]);
  const [selectedKeywordGroups, setSelectedKeywordGroups] = React.useState<Set<number>>(new Set());
  const [generatingKeywords, setGeneratingKeywords] = React.useState(false);
  const [activeCpcFilters, setActiveCpcFilters] = React.useState<Set<string>>(new Set());
  const [keywordsOpen, setKeywordsOpen] = React.useState(false);

  // Search matrix
  const [searchMatrix, setSearchMatrix] = React.useState<SearchMatrixData | null>(
    initialMatrix ? {
      cpcEntries: (initialMatrix.cpcEntries as SearchMatrixEntry[]) || [],
      combinedQueries: (initialMatrix.combinedQueries as SearchMatrixData["combinedQueries"]) || [],
      searchWorkflow: (initialMatrix.searchWorkflow as SearchMatrixData["searchWorkflow"]) || { passes: [] },
      strongestTerms: (initialMatrix.strongestTerms as SearchMatrixData["strongestTerms"]) || { structureTerms: [], conversionTerms: [], cleanupTerms: [], inputFormatTerms: [] },
      priorArtRiskAreas: (initialMatrix.priorArtRiskAreas as SearchMatrixData["priorArtRiskAreas"]) || [],
    } : null
  );
  const [generatingMatrix, setGeneratingMatrix] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("search");

  const patentCpcCodes = React.useMemo(
    () => (patent.cpcCodes as string[]) || [],
    [patent.cpcCodes]
  );

  const idsCount = React.useMemo(
    () => results.filter((r) => r.addedToIds).length,
    [results]
  );

  async function handleGenerateKeywords() {
    setGeneratingKeywords(true);
    try {
      const res = await fetch("/api/ai/search-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventionDescription: patent.inventionDescription || patent.title,
          cpcCodes: patentCpcCodes,
          keyFeatures: patent.keyFeatures,
          jurisdiction: patent.jurisdiction,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to generate keywords");
      }
      const data = await res.json();
      setKeywordGroups(data.keywordGroups || []);
      setKeywordsOpen(true);
      toast.success(`Generated ${data.keywordGroups?.length || 0} keyword groups`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate keywords");
    } finally {
      setGeneratingKeywords(false);
    }
  }

  async function handleGenerateMatrix() {
    setGeneratingMatrix(true);
    try {
      const res = await fetch("/api/ai/search-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventionDescription: patent.inventionDescription || patent.title,
          cpcCodes: patentCpcCodes,
          keyFeatures: patent.keyFeatures,
          technicalField: patent.technologyArea,
          jurisdiction: patent.jurisdiction,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to generate search matrix");
      }
      const data: SearchMatrixData = await res.json();
      setSearchMatrix(data);
      setMatrixOpen(true);

      try {
        await saveSearchMatrix({
          patentId: patent.id,
          cpcEntries: data.cpcEntries,
          combinedQueries: data.combinedQueries,
          searchWorkflow: data.searchWorkflow,
          keywordGroups: keywordGroups.length > 0 ? keywordGroups : undefined,
          strongestTerms: data.strongestTerms,
          priorArtRiskAreas: data.priorArtRiskAreas,
          generatedByModel: "gemini-3.1-pro",
        });
      } catch {
        console.error("Failed to persist search matrix");
      }

      toast.success(`Generated search matrix with ${data.cpcEntries?.length || 0} CPC entries`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate matrix");
    } finally {
      setGeneratingMatrix(false);
    }
  }

  function toggleCpcFilter(code: string) {
    setActiveCpcFilters((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleKeywordGroup(idx: number) {
    setSelectedKeywordGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function useQueryFromMatrix(queryString: string) {
    setQuery(queryString);
    setActiveTab("search");
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSourceErrors([]);

    const sources: string[] = [];
    if (sourcePatentsView) sources.push("patentsview");
    if (sourceEpo) sources.push("epo");
    if (sources.length === 0) {
      setSearchError("Select at least one source before searching.");
      setSearching(false);
      return;
    }

    const selectedGroups = keywordGroups
      .filter((_, i) => selectedKeywordGroups.has(i))
      .map((g) => ({ category: g.category, keywords: g.keywords }));

    const cpcFilters = Array.from(activeCpcFilters);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          sources,
          patentId: patent.id,
          cpcCodes: cpcFilters.length > 0 ? cpcFilters : undefined,
          keywordGroups: selectedGroups.length > 0 ? selectedGroups : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Search failed");
      }

      setSourceErrors(
        Array.isArray(data?.meta?.errors) ? data.meta.errors : []
      );
      if (data.results && data.results.length > 0) {
        const mapped: DisplayResult[] = data.results.map(
          (r: SearchApiResult & { matchedQuery?: string; matchedCpcCodes?: string[] }) => ({
            ...r,
            addedToIds: false,
          })
        );
        setResults(mapped);

        try {
          const search = await savePriorArtSearch({
            patentId: patent.id,
            query: query.trim(),
            apiSources: sources,
            resultCount: data.results.length,
            keywordGroupsUsed: selectedGroups.length > 0 ? selectedGroups.map((g) => ({ ...g, description: "" })) : undefined,
            cpcFilters: cpcFilters.length > 0 ? cpcFilters : undefined,
            searchStrategy: cpcFilters.length > 0 ? "cpc_filtered" : "standard",
          });
          await savePriorArtResults(
            search.id,
            patent.id,
            data.results.map((r: SearchApiResult & { matchedQuery?: string; matchedCpcCodes?: string[] }) => ({
              externalPatentNumber: r.patentNumber,
              title: r.title,
              abstract: r.abstract || undefined,
              assignee: r.assignee || undefined,
              filingDate: r.filingDate || undefined,
              sourceApi: r.sourceApi,
              externalUrl: r.externalUrl || undefined,
              matchedQuery: r.matchedQuery,
              matchedCpcCodes: r.matchedCpcCodes,
            }))
          );
        } catch {
          console.error("Failed to persist search results");
        }

        toast.success(`Found ${data.results.length} results`);
      } else if (data.results) {
        setResults([]);
        toast.info("No results found");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      setSearchError(message);
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }

  async function handleViewPatent(result: DisplayResult) {
    setSelectedResult(result);
    setSheetMode("view");
    setSheetOpen(true);

    if (result.viewData) return;

    setViewLoading(true);
    try {
      const source = result.sourceApi === "epo" ? "epo" : "auto";
      const res = await fetch(
        `/api/patents/view?patentNumber=${encodeURIComponent(result.patentNumber)}&source=${source}`
      );
      if (!res.ok) throw new Error("Failed to fetch patent details");

      const data: PatentViewData = await res.json();
      setResults((prev) =>
        prev.map((r) =>
          r.id === result.id ? { ...r, viewData: data, abstract: data.abstract || r.abstract, title: data.title || r.title } : r
        )
      );
      setSelectedResult((prev) =>
        prev ? { ...prev, viewData: data, abstract: data.abstract || prev.abstract, title: data.title || prev.title } : prev
      );
    } catch (err) {
      toast.error("Failed to load patent details");
      console.error("View patent error:", err);
    } finally {
      setViewLoading(false);
    }
  }

  const analyzeMutation = useMutation({
    mutationFn: async (result: DisplayResult) => {
      const claimText = buildClaimText(patent);
      const priorArtAbstract =
        result.abstract ||
        result.viewData?.abstract ||
        result.title;

      if (!priorArtAbstract || priorArtAbstract.length < 5) {
        throw new Error(
          "No abstract available. Click 'View' first to load patent details."
        );
      }

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: (() => {
            const stored = (patent.aiModelConfig as { analysisModel?: string })?.analysisModel;
            if (stored && ["gemini-3.1-pro","gemini-2.5-flash","gemini-2.5-pro","gpt-4o-mini","gpt-4o","o3","o4-mini"].includes(stored)) return stored;
            return "gemini-3.1-pro";
          })(),
          claimText,
          priorArtAbstract,
          priorArtTitle: result.title,
          jurisdiction: patent.jurisdiction,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Analysis failed (${res.status})`);
      }

      return (await res.json()) as Analysis;
    },
    onMutate: (result) => {
      setResults((prev) =>
        prev.map((r) =>
          r.id === result.id ? { ...r, analysing: true } : r
        )
      );
    },
    onSuccess: (data, result) => {
      const updated: DisplayResult = {
        ...result,
        riskLevel: data.riskLevel,
        relevanceScore: data.relevanceScore,
        analysis: data,
        analysing: false,
      };
      setResults((prev) =>
        prev.map((r) => (r.id === result.id ? updated : r))
      );
      setSelectedResult(updated);
      setSheetMode("analysis");
      setSheetOpen(true);
      toast.success("Analysis complete");
    },
    onError: (err: Error, result) => {
      setResults((prev) =>
        prev.map((r) =>
          r.id === result.id ? { ...r, analysing: false } : r
        )
      );
      toast.error(err.message || "Analysis failed");
    },
  });

  function toggleIds(resultId: string) {
    const result = results.find((r) => r.id === resultId);
    const newValue = !result?.addedToIds;
    setResults((prev) =>
      prev.map((r) =>
        r.id === resultId ? { ...r, addedToIds: newValue } : r
      )
    );
    togglePriorArtIDS(resultId, patent.id, newValue).catch(() => {
      toast.error("Failed to update IDS status");
    });
  }

  const filteredResults = React.useMemo(() => {
    if (sourceFilter === "all") return results;
    return results.filter((r) => r.sourceApi === sourceFilter);
  }, [results, sourceFilter]);

  const columns = React.useMemo<ColumnDef<DisplayResult>[]>(
    () => [
      {
        accessorKey: "patentNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Patent Number
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">
            {row.original.patentNumber}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Title
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[280px] truncate" title={row.original.title}>
            {row.original.title}
          </div>
        ),
      },
      {
        accessorKey: "assignee",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Assignee
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[180px] truncate">
            {row.original.assignee || "—"}
          </div>
        ),
      },
      {
        accessorKey: "sourceApi",
        header: "Source",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {SOURCE_LABELS[row.original.sourceApi] || row.original.sourceApi}
          </Badge>
        ),
      },
      {
        id: "riskLevel",
        header: "Risk",
        cell: ({ row }) => {
          const risk = row.original.riskLevel;
          if (!risk) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          const cfg = RISK_CONFIG[risk];
          return (
            <Badge variant="secondary" className={cfg.className}>
              {risk === "high" && (
                <AlertTriangle className="h-3 w-3 mr-0.5" />
              )}
              {risk === "medium" && <Shield className="h-3 w-3 mr-0.5" />}
              {cfg.label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewPatent(r);
                }}
              >
                <Eye className="h-3 w-3" /> View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={r.analysing || analyzeMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  analyzeMutation.mutate(r);
                }}
              >
                {r.analysing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Analyze"
                )}
              </Button>
              <Button
                variant={r.addedToIds ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleIds(r.id);
                }}
              >
                {r.addedToIds ? (
                  <>
                    <FileText className="h-3 w-3 mr-0.5" /> IDS
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-0.5" /> IDS
                  </>
                )}
              </Button>
              <a
                href={r.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          );
        },
      },
    ],
    [analyzeMutation]
  );

  const table = useReactTable({
    data: filteredResults,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Search className="h-5 w-5" />
            Prior Art Search
          </h2>
          <p className="text-muted-foreground text-sm">
            Search and analyze prior art for{" "}
            <span className="font-medium text-foreground">{patent.title}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {idsCount > 0 && (
            <Badge className="text-sm px-3 py-1">
              <FileText className="h-3.5 w-3.5 mr-1" />
              {idsCount} added to IDS
            </Badge>
          )}
        </div>
      </div>

      {/* Research Tools */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Research Tools
          </CardTitle>
          <CardDescription>
            Generate AI-powered keyword groups and CPC search matrices to guide your prior art search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleGenerateKeywords}
              disabled={generatingKeywords}
              className="gap-2"
            >
              {generatingKeywords ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Tag className="h-4 w-4" />
              )}
              Generate Keywords
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateMatrix}
              disabled={generatingMatrix}
              className="gap-2"
            >
              {generatingMatrix ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Grid3X3 className="h-4 w-4" />
              )}
              Generate Search Matrix
            </Button>
            {searchMatrix && (
              <a
                href={`/api/export/search-matrix?patentId=${patent.id}`}
                download
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Matrix (DOCX)
                </Button>
              </a>
            )}
          </div>

          {/* CPC Filter Bar */}
          {patentCpcCodes.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium block mb-2">
                CPC Filters (click to toggle):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {patentCpcCodes.map((code) => (
                  <Badge
                    key={code}
                    variant={activeCpcFilters.has(code) ? "default" : "outline"}
                    className="cursor-pointer text-xs px-2 py-0.5 transition-colors"
                    onClick={() => toggleCpcFilter(code)}
                  >
                    {code}
                    {activeCpcFilters.has(code) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
                {searchMatrix?.cpcEntries
                  ?.filter((e) => !patentCpcCodes.includes(e.cpcCode))
                  .map((e) => (
                    <Badge
                      key={e.cpcCode}
                      variant={activeCpcFilters.has(e.cpcCode) ? "default" : "secondary"}
                      className="cursor-pointer text-xs px-2 py-0.5 transition-colors"
                      onClick={() => toggleCpcFilter(e.cpcCode)}
                    >
                      {e.cpcCode} (suggested)
                      {activeCpcFilters.has(e.cpcCode) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                {activeCpcFilters.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setActiveCpcFilters(new Set())}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Keyword Groups Panel */}
          {keywordGroups.length > 0 && (
            <Collapsible open={keywordsOpen} onOpenChange={setKeywordsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-3.5 w-3.5" />
                    Keyword Groups ({keywordGroups.length})
                    {selectedKeywordGroups.size > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedKeywordGroups.size} active
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${keywordsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {keywordGroups.map((group, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedKeywordGroups.has(idx) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleKeywordGroup(idx)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{group.category}</span>
                      <Checkbox
                        checked={selectedKeywordGroups.has(idx)}
                        onCheckedChange={() => toggleKeywordGroup(idx)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{group.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.keywords.slice(0, 8).map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuery((prev) => (prev ? `${prev} ${kw}` : kw));
                          }}
                        >
                          {kw}
                        </Badge>
                      ))}
                      {group.keywords.length > 8 && (
                        <span className="text-xs text-muted-foreground">
                          +{group.keywords.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Search Matrix Panel */}
          {searchMatrix && (
            <Collapsible open={matrixOpen} onOpenChange={setMatrixOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Grid3X3 className="h-3.5 w-3.5" />
                    CPC Search Matrix ({searchMatrix.cpcEntries.length} entries)
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${matrixOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="rounded-md border overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">CPC Code</TableHead>
                        <TableHead className="w-48">Focus</TableHead>
                        <TableHead>Keywords</TableHead>
                        <TableHead className="w-20">Rank</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchMatrix.cpcEntries
                        .sort((a, b) => b.relevanceRanking - a.relevanceRanking)
                        .map((entry, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge
                                variant={activeCpcFilters.has(entry.cpcCode) ? "default" : "outline"}
                                className="cursor-pointer font-mono text-xs"
                                onClick={() => toggleCpcFilter(entry.cpcCode)}
                              >
                                {entry.cpcCode}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{entry.plainEnglishFocus}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {entry.keywords.slice(0, 4).map((kw) => (
                                  <Badge key={kw} variant="secondary" className="text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                                {entry.keywords.length > 4 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{entry.keywords.length - 4}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs font-medium">
                                {entry.relevanceRanking}/10
                              </span>
                            </TableCell>
                            <TableCell>
                              {entry.starterQueries.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => useQueryFromMatrix(entry.starterQueries[0])}
                                >
                                  Use
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {searchMatrix.combinedQueries.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-muted-foreground block mb-2">
                      Combined Queries:
                    </span>
                    <div className="space-y-1.5">
                      {searchMatrix.combinedQueries.map((cq, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer"
                          onClick={() => useQueryFromMatrix(cq.queryString)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{cq.description}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{cq.queryString}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0 ml-2">
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchMatrix.priorArtRiskAreas.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-muted-foreground block mb-2">
                      Prior Art Risk Areas:
                    </span>
                    <div className="space-y-1.5">
                      {searchMatrix.priorArtRiskAreas.map((area, idx) => (
                        <div key={idx} className="border rounded-md px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            <span className="text-xs font-medium">{area.area}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{area.description}</p>
                          <div className="flex gap-1 mt-1">
                            {area.likelyCpcCodes.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs">
                                {code}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search patent databases by keyword, description, or claim language..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="h-11"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="h-11 px-6"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </div>

          <div className="flex items-center gap-6 mt-3">
            <span className="text-xs text-muted-foreground font-medium">
              Sources:
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sourcePatentsView}
                onCheckedChange={(v) => {
                  setSearchError(null);
                  setSourcePatentsView(v === true);
                }}
              />
              <span className="text-sm">USPTO / PatentsView</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sourceEpo}
                onCheckedChange={(v) => {
                  setSearchError(null);
                  setSourceEpo(v === true);
                }}
              />
              <span className="text-sm">EPO OPS (Worldwide)</span>
            </label>
            {(activeCpcFilters.size > 0 || selectedKeywordGroups.size > 0) && (
              <span className="text-xs text-primary font-medium ml-auto">
                {activeCpcFilters.size > 0 && `${activeCpcFilters.size} CPC filter(s)`}
                {activeCpcFilters.size > 0 && selectedKeywordGroups.size > 0 && " + "}
                {selectedKeywordGroups.size > 0 && `${selectedKeywordGroups.size} keyword group(s)`}
                {" active"}
              </span>
            )}
          </div>
          {searchError && (
            <p className="mt-3 text-sm text-destructive">{searchError}</p>
          )}
          {sourceErrors.length > 0 && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <ul className="space-y-1">
                {sourceErrors.map((msg) => (
                  <li key={msg} className="text-xs text-destructive">
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Results
              {results.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredResults.length}
                  {sourceFilter !== "all" && ` of ${results.length}`})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs border rounded-md px-2 py-1 bg-background"
              >
                <option value="all">All Sources</option>
                <option value="patentsview">USPTO / PatentsView</option>
                <option value="epo">EPO OPS</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {searching ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm max-w-md">
                Enter keywords above to search across patent databases. Try
                using terms from your claims or invention description.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => handleViewPatent(row.original)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No results match the current filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of{" "}
                  {table.getPageCount()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Patent View / Analysis Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-lg">
              {selectedResult?.patentNumber}
            </SheetTitle>
            <SheetDescription className="line-clamp-2">
              {selectedResult?.title}
            </SheetDescription>
          </SheetHeader>

          {selectedResult && (
            <div className="mt-4">
              <Tabs
                value={sheetMode}
                onValueChange={(v) => setSheetMode(v as "view" | "analysis")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="view" className="flex-1 gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Patent Details
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="flex-1 gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> AI Analysis
                  </TabsTrigger>
                </TabsList>

                {/* View Tab */}
                <TabsContent value="view">
                  <ScrollArea className="h-[calc(100vh-220px)]">
                    <div className="space-y-5 pr-4 pb-6">
                      {viewLoading ? (
                        <div className="space-y-4 py-8">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">
                              Loading patent details...
                            </span>
                          </div>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : (
                        <>
                          {/* Meta info */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Patent Number
                              </span>
                              <p className="font-mono font-medium">
                                {selectedResult.patentNumber}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Filing Date
                              </span>
                              <p>
                                {selectedResult.viewData?.filingDate ||
                                  selectedResult.filingDate ||
                                  "—"}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Assignee
                              </span>
                              <p>
                                {selectedResult.viewData?.assignee ||
                                  selectedResult.assignee ||
                                  "—"}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">
                                Source
                              </span>
                              <p>
                                {SOURCE_LABELS[selectedResult.sourceApi] ||
                                  selectedResult.sourceApi}
                              </p>
                            </div>
                            {selectedResult.viewData?.inventors &&
                              selectedResult.viewData.inventors.length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground text-xs">
                                    Inventors
                                  </span>
                                  <p>
                                    {selectedResult.viewData.inventors.join(
                                      ", "
                                    )}
                                  </p>
                                </div>
                              )}
                          </div>

                          <Separator />

                          {/* Abstract */}
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Abstract
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {selectedResult.viewData?.abstract ||
                                selectedResult.abstract ||
                                "No abstract available. Try clicking View to load details."}
                            </p>
                          </div>

                          {/* Images */}
                          {selectedResult.viewData?.images &&
                            selectedResult.viewData.images.length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Patent Drawings (
                                    {selectedResult.viewData.images.length})
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    {selectedResult.viewData.images.map(
                                      (img, idx) => (
                                        <div
                                          key={idx}
                                          className="border rounded-lg overflow-hidden bg-white"
                                        >
                                          <img
                                            src={img.url}
                                            alt={img.label}
                                            className="w-full h-auto object-contain max-h-48"
                                            loading="lazy"
                                          />
                                          <p className="text-xs text-center py-1 text-muted-foreground bg-muted/30">
                                            {img.label}
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </>
                            )}

                          {/* Claims */}
                          {selectedResult.viewData?.claims &&
                            selectedResult.viewData.claims.length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-medium mb-2">
                                    Claims (
                                    {selectedResult.viewData.claims.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {selectedResult.viewData.claims
                                      .slice(0, 5)
                                      .map((claim, idx) => (
                                        <p
                                          key={idx}
                                          className="text-xs text-muted-foreground leading-relaxed border-l-2 pl-3"
                                        >
                                          {idx + 1}. {claim}
                                        </p>
                                      ))}
                                    {selectedResult.viewData.claims.length >
                                      5 && (
                                      <p className="text-xs text-muted-foreground italic">
                                        +{" "}
                                        {selectedResult.viewData.claims.length -
                                          5}{" "}
                                        more claims
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}

                          {/* Description excerpt */}
                          {selectedResult.viewData?.description && (
                            <>
                              <Separator />
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  Description (excerpt)
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                                  {selectedResult.viewData.description}
                                </p>
                              </div>
                            </>
                          )}

                          <Separator />

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              size="sm"
                              disabled={
                                selectedResult.analysing ||
                                analyzeMutation.isPending
                              }
                              onClick={() =>
                                analyzeMutation.mutate(selectedResult)
                              }
                            >
                              {selectedResult.analysing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : (
                                <Shield className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Analyze
                            </Button>
                            <Button
                              className="flex-1"
                              size="sm"
                              variant={
                                selectedResult.addedToIds
                                  ? "secondary"
                                  : "outline"
                              }
                              onClick={() => {
                                toggleIds(selectedResult.id);
                                setSelectedResult((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        addedToIds: !prev.addedToIds,
                                      }
                                    : prev
                                );
                              }}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5" />
                              {selectedResult.addedToIds
                                ? "Remove from IDS"
                                : "Add to IDS"}
                            </Button>
                          </div>

                          <a
                            href={selectedResult.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full gap-1.5 text-xs"
                            >
                              <ExternalLink className="h-3 w-3" /> Open in
                              External Source
                            </Button>
                          </a>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Analysis Tab */}
                <TabsContent value="analysis">
                  <ScrollArea className="h-[calc(100vh-220px)]">
                    {selectedResult?.analysis ? (
                      <div className="space-y-6 pr-4 pb-6">
                        <div className="flex items-center gap-4">
                          <Badge
                            variant="secondary"
                            className={`text-sm px-3 py-1 ${RISK_CONFIG[selectedResult.analysis.riskLevel].className}`}
                          >
                            {selectedResult.analysis.riskLevel === "high" && (
                              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            )}
                            {selectedResult.analysis.riskLevel === "medium" && (
                              <Shield className="h-3.5 w-3.5 mr-1" />
                            )}
                            {
                              RISK_CONFIG[selectedResult.analysis.riskLevel]
                                .label
                            }
                          </Badge>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">
                              Relevance Score
                            </span>
                            <span className="text-sm font-mono">
                              {(
                                selectedResult.analysis.relevanceScore * 100
                              ).toFixed(0)}
                              %
                            </span>
                          </div>
                          <Progress
                            value={
                              selectedResult.analysis.relevanceScore * 100
                            }
                          />
                        </div>

                        <Separator />

                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Analysis
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {selectedResult.analysis.analysis}
                          </p>
                        </div>

                        <Separator />

                        {selectedResult.analysis.overlappingElements.length >
                          0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              Overlapping Elements
                            </h4>
                            <ul className="space-y-1.5">
                              {selectedResult.analysis.overlappingElements.map(
                                (el, i) => (
                                  <li
                                    key={i}
                                    className="text-sm text-muted-foreground flex items-start gap-2"
                                  >
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                    {el}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                        {selectedResult.analysis.differentiatingFeatures
                          .length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                              <Shield className="h-3.5 w-3.5 text-green-500" />
                              Differentiating Features
                            </h4>
                            <ul className="space-y-1.5">
                              {selectedResult.analysis.differentiatingFeatures.map(
                                (el, i) => (
                                  <li
                                    key={i}
                                    className="text-sm text-muted-foreground flex items-start gap-2"
                                  >
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                                    {el}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                        <Separator />

                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Recommendation
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {selectedResult.analysis.recommendation}
                          </p>
                        </div>

                        <Separator />

                        <Button
                          className="w-full"
                          variant={
                            selectedResult.addedToIds ? "secondary" : "default"
                          }
                          onClick={() => {
                            toggleIds(selectedResult.id);
                            setSelectedResult((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    addedToIds: !prev.addedToIds,
                                  }
                                : prev
                            );
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {selectedResult.addedToIds
                            ? "Remove from IDS"
                            : "Add to IDS"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                          No analysis yet for this patent.
                        </p>
                        <Button
                          size="sm"
                          disabled={
                            selectedResult.analysing ||
                            analyzeMutation.isPending
                          }
                          onClick={() =>
                            analyzeMutation.mutate(selectedResult)
                          }
                        >
                          {selectedResult.analysing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Run AI Analysis
                        </Button>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

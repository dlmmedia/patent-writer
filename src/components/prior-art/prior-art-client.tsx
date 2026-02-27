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
import type { Patent, PriorArtResult, RiskLevel } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Search,
  ExternalLink,
  AlertTriangle,
  Shield,
  FileText,
  Plus,
  ChevronDown,
  Filter,
  Loader2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

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

interface DisplayResult extends SearchApiResult {
  riskLevel?: RiskLevel;
  relevanceScore?: number;
  analysis?: Analysis;
  addedToIds: boolean;
  analysing?: boolean;
}

interface PriorArtClientProps {
  patent: Patent & {
    sections: { id: string; sectionType: string; plainText: string | null }[];
    claims: { id: string; fullText: string }[];
  };
  initialResults: PriorArtResult[];
}

// ─── Helpers ────────────────────────────────────────────────

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
  patentsview: "USPTO (PatentsView)",
  epo: "EPO OPS",
};

function buildClaimText(patent: PriorArtClientProps["patent"]): string {
  if (patent.claims.length > 0) {
    return patent.claims.map((c) => c.fullText).join("\n\n");
  }
  const abstract = patent.sections.find((s) => s.sectionType === "abstract");
  return abstract?.plainText || patent.title;
}

// ─── Component ──────────────────────────────────────────────

export function PriorArtClient({ patent, initialResults }: PriorArtClientProps) {
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
  const [selectedResult, setSelectedResult] = React.useState<DisplayResult | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");

  const idsCount = React.useMemo(
    () => results.filter((r) => r.addedToIds).length,
    [results]
  );

  // ─── Search mutation ────────────────────────────────────

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);

    const sources: string[] = [];
    if (sourcePatentsView) sources.push("patentsview");
    if (sourceEpo) sources.push("epo");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), sources, patentId: patent.id }),
      });
      const data = await res.json();
      if (data.results) {
        const mapped: DisplayResult[] = data.results.map(
          (r: SearchApiResult) => ({
            ...r,
            addedToIds: false,
          })
        );
        setResults(mapped);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }

  // ─── Analyze mutation ───────────────────────────────────

  const analyzeMutation = useMutation({
    mutationFn: async (result: DisplayResult) => {
      const claimText = buildClaimText(patent);
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: patent.aiModelConfig
            ? (patent.aiModelConfig as { analysisModel: string }).analysisModel
            : "gemini-2.5-pro",
          claimText,
          priorArtAbstract: result.abstract,
          priorArtTitle: result.title,
          jurisdiction: patent.jurisdiction,
        }),
      });
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
      setSheetOpen(true);
    },
    onError: (_err, result) => {
      setResults((prev) =>
        prev.map((r) =>
          r.id === result.id ? { ...r, analysing: false } : r
        )
      );
    },
  });

  // ─── IDS toggle ─────────────────────────────────────────

  function toggleIds(resultId: string) {
    setResults((prev) =>
      prev.map((r) =>
        r.id === resultId ? { ...r, addedToIds: !r.addedToIds } : r
      )
    );
  }

  // ─── Filtered results ───────────────────────────────────

  const filteredResults = React.useMemo(() => {
    if (sourceFilter === "all") return results;
    return results.filter((r) => r.sourceApi === sourceFilter);
  }, [results, sourceFilter]);

  // ─── Table columns ─────────────────────────────────────

  const columns = React.useMemo<ColumnDef<DisplayResult>[]>(
    () => [
      {
        accessorKey: "patentNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
        accessorKey: "filingDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Filing Date
            <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.filingDate || "—"}
          </span>
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
              {risk === "high" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
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
                className="h-7 text-xs"
                disabled={r.analysing || analyzeMutation.isPending}
                onClick={() => analyzeMutation.mutate(r)}
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
                onClick={() => toggleIds(r.id)}
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

  // ─── Render ─────────────────────────────────────────────

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
        {idsCount > 0 && (
          <Badge className="text-sm px-3 py-1">
            <FileText className="h-3.5 w-3.5 mr-1" />
            {idsCount} added to IDS
          </Badge>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search patent databases by keyword, description, or claim language…"
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
                onCheckedChange={(v) => setSourcePatentsView(v === true)}
              />
              <span className="text-sm">PatentsView (US)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sourceEpo}
                onCheckedChange={(v) => setSourceEpo(v === true)}
              />
              <span className="text-sm">EPO OPS (Worldwide)</span>
            </label>
          </div>
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
                <option value="patentsview">USPTO (PatentsView)</option>
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
                          onClick={() => {
                            if (row.original.analysis) {
                              setSelectedResult(row.original);
                              setSheetOpen(true);
                            }
                          }}
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

              {/* Pagination */}
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

      {/* Analysis Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-lg">Prior Art Analysis</SheetTitle>
            <SheetDescription>
              {selectedResult?.patentNumber} — {selectedResult?.title}
            </SheetDescription>
          </SheetHeader>

          {selectedResult?.analysis ? (
            <ScrollArea className="flex-1 px-4 pb-6">
              <div className="space-y-6">
                {/* Risk + Score */}
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
                    {RISK_CONFIG[selectedResult.analysis.riskLevel].label}
                  </Badge>
                </div>

                {/* Relevance Score */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">
                      Relevance Score
                    </span>
                    <span className="text-sm font-mono">
                      {(selectedResult.analysis.relevanceScore * 100).toFixed(0)}
                      %
                    </span>
                  </div>
                  <Progress
                    value={selectedResult.analysis.relevanceScore * 100}
                  />
                </div>

                <Separator />

                {/* AI Analysis */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Analysis</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedResult.analysis.analysis}
                  </p>
                </div>

                <Separator />

                {/* Overlapping Elements */}
                {selectedResult.analysis.overlappingElements.length > 0 && (
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

                {/* Differentiating Features */}
                {selectedResult.analysis.differentiatingFeatures.length > 0 && (
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

                {/* Recommendation */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Recommendation</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedResult.analysis.recommendation}
                  </p>
                </div>

                <Separator />

                {/* Add to IDS */}
                <Button
                  className="w-full"
                  variant={selectedResult.addedToIds ? "secondary" : "default"}
                  onClick={() => {
                    toggleIds(selectedResult.id);
                    setSelectedResult((prev) =>
                      prev
                        ? { ...prev, addedToIds: !prev.addedToIds }
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
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-12">
              <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Click &ldquo;Analyze&rdquo; on a result to see the AI analysis.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

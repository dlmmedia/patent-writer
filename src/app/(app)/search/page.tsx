"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  ExternalLink,
  Import,
  ChevronLeft,
  ChevronRight,
  Globe,
  Building2,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { createPatent } from "@/lib/actions/patents";

interface SearchResult {
  id: string;
  patentNumber: string;
  title: string;
  abstract: string;
  assignee: string;
  filingDate: string;
  sourceApi: "patentsview" | "epo";
  externalUrl: string;
}

interface ApiResponse {
  results: SearchResult[];
  meta: {
    query: string;
    totalResults: number;
    sources: string[];
    errors?: string[];
  };
}

const PAGE_SIZE = 10;

async function fetchSearch(
  query: string,
  sources: string[]
): Promise<ApiResponse> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, sources }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Search failed");
  return data;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sources, setSources] = useState<string[]>(["patentsview", "epo"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleImport(result: SearchResult) {
    setImportingId(result.id);
    startTransition(async () => {
      const patent = await createPatent({
        title: result.title || "Untitled Patent",
        type: "utility",
        jurisdiction: result.sourceApi === "epo" ? "EP" : "US",
        inventionDescription: result.abstract || undefined,
      });
      router.push(`/patents/${patent.id}`);
    });
  }

  const { data, isLoading, isFetching, error } = useQuery<ApiResponse>({
    queryKey: ["patent-search", submittedQuery, sources],
    queryFn: () => fetchSearch(submittedQuery, sources),
    enabled: submittedQuery.length > 0,
    placeholderData: (prev) => prev,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (sources.length === 0) {
      setFormError("Select at least one source before searching.");
      return;
    }
    if (query.trim()) {
      setFormError(null);
      setSubmittedQuery(query.trim());
      setPage(1);
    }
  }

  function toggleSource(source: string) {
    setFormError(null);
    setSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  }

  const allResults = data?.results ?? [];
  const totalResults = allResults.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const paginatedResults = allResults.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="heading-serif text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Patent Search
        </h2>
        <p className="text-muted-foreground">
          Search global patent databases for prior art and references
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patents by keyword, title, abstract, or patent number..."
                  className="pl-10 h-12 text-base shadow-inner focus-gold"
                />
              </div>
              <Button type="submit" disabled={!query.trim() || isLoading || sources.length === 0} size="lg" className="h-12 px-6 btn-press legal-gradient text-white hover:opacity-90">
                Search
              </Button>
            </div>

            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-muted-foreground">
                Sources:
              </span>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="src-pv"
                  checked={sources.includes("patentsview")}
                  onCheckedChange={() => toggleSource("patentsview")}
                />
                <Label htmlFor="src-pv" className="text-sm cursor-pointer">
                  USPTO Data / PatentsView
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="src-epo"
                  checked={sources.includes("epo")}
                  onCheckedChange={() => toggleSource("epo")}
                />
                <Label htmlFor="src-epo" className="text-sm cursor-pointer">
                  EPO Open Patent Services
                </Label>
              </div>
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {error instanceof Error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {isLoading && submittedQuery && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalResults > 0
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                    page * PAGE_SIZE,
                    totalResults
                  )} of ${totalResults.toLocaleString()} results`
                : "No results found"}
              {isFetching && " (updating...)"}
            </p>
            {data.meta.errors && data.meta.errors.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {data.meta.errors.length} source error(s)
              </Badge>
            )}
          </div>
          {data.meta.errors && data.meta.errors.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-4">
                <ul className="space-y-1">
                  {data.meta.errors.map((msg) => (
                    <li key={msg} className="text-xs text-destructive">
                      {msg}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {paginatedResults.map((result) => (
              <Card key={result.id} className="card-hover border-l-4 border-l-transparent hover:border-l-[oklch(0.72_0.12_85)]">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base leading-tight">
                        {result.title || "Untitled Patent"}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {result.patentNumber}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        result.sourceApi === "patentsview" ? "default" : "secondary"
                      }
                    >
                      {result.sourceApi === "patentsview" ? "USPTO" : "EPO"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.abstract && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {result.abstract}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {result.assignee && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {result.assignee}
                      </span>
                    )}
                    {result.filingDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {result.filingDate}
                      </span>
                    )}
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={result.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </a>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isPending && importingId === result.id}
                      onClick={() => handleImport(result)}
                    >
                      {isPending && importingId === result.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Import className="h-3 w-3 mr-1" />
                      )}
                      {isPending && importingId === result.id
                        ? "Importing..."
                        : "Import to New Patent"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!submittedQuery && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="heading-serif text-lg font-medium mb-1">Search Patent Databases</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter keywords, patent numbers, or technical terms to search across
              USPTO and EPO databases for prior art and related patents.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

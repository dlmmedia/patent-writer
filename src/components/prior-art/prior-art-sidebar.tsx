"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, ExternalLink, AlertTriangle, Shield, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  savePriorArtSearch,
  savePriorArtResults,
  getPriorArtResults,
  togglePriorArtIDS,
  deletePriorArtResult,
} from "@/lib/actions/patents";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  patentNumber: string;
  title: string;
  abstract: string;
  assignee: string;
  filingDate: string;
  sourceApi: string;
  externalUrl: string;
}

interface SavedResult {
  id: string;
  externalPatentNumber: string | null;
  title: string;
  abstract: string | null;
  assignee: string | null;
  filingDate: string | null;
  relevanceScore: number | null;
  riskLevel: "high" | "medium" | "low" | null;
  aiAnalysis: string | null;
  sourceApi: string;
  externalUrl: string | null;
  addedToIds: boolean | null;
}

const RISK_CONFIG = {
  high: { label: "High Risk", icon: AlertTriangle, className: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30" },
  medium: { label: "Medium", icon: Shield, className: "text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30" },
  low: { label: "Low Risk", icon: ShieldCheck, className: "text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30" },
};

export function PriorArtSidebar({ patentId }: { patentId: string }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSavedResults = useCallback(async () => {
    try {
      const results = await getPriorArtResults(patentId);
      setSavedResults(results as SavedResult[]);
    } catch {
      console.error("Failed to load prior art results");
    } finally {
      setLoading(false);
    }
  }, [patentId]);

  useEffect(() => {
    loadSavedResults();
  }, [loadSavedResults]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          sources: ["patentsview", "epo"],
          patentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setSearchResults(data.results || []);

      if (data.results?.length > 0) {
        toast.success(`Found ${data.results.length} results`);
      } else {
        toast.info("No results found");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      toast.error(msg);
    } finally {
      setSearching(false);
    }
  }

  async function handleSaveResults() {
    if (searchResults.length === 0) return;
    setSaving(true);

    try {
      const search = await savePriorArtSearch({
        patentId,
        query: query.trim(),
        apiSources: ["patentsview", "epo"],
        resultCount: searchResults.length,
      });

      await savePriorArtResults(
        search.id,
        patentId,
        searchResults.map((r) => ({
          externalPatentNumber: r.patentNumber,
          title: r.title,
          abstract: r.abstract || undefined,
          assignee: r.assignee || undefined,
          filingDate: r.filingDate || undefined,
          sourceApi: r.sourceApi,
          externalUrl: r.externalUrl || undefined,
        }))
      );

      toast.success("Results saved");
      setSearchResults([]);
      await loadSavedResults();
    } catch {
      toast.error("Failed to save results");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleIDS(id: string, current: boolean | null) {
    try {
      await togglePriorArtIDS(id, patentId, !current);
      setSavedResults((prev) =>
        prev.map((r) => (r.id === id ? { ...r, addedToIds: !current } : r))
      );
    } catch {
      toast.error("Failed to update IDS status");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePriorArtResult(id, patentId);
      setSavedResults((prev) => prev.filter((r) => r.id !== id));
      toast.success("Result removed");
    } catch {
      toast.error("Failed to remove result");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Search prior art..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="h-8 px-3 shrink-0"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {searchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Search Results ({searchResults.length})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2"
                  onClick={handleSaveResults}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save All"}
                </Button>
              </div>
              {searchResults.map((result) => (
                <div key={result.id} className="rounded-md border p-2.5 space-y-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight line-clamp-2">{result.title}</p>
                    {result.externalUrl && (
                      <a href={result.externalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{result.patentNumber}</Badge>
                    <span>{result.assignee}</span>
                  </div>
                </div>
              ))}
              <Separator />
            </>
          )}

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : savedResults.length > 0 ? (
            <>
              <span className="text-xs font-medium text-muted-foreground">
                Saved Results ({savedResults.length})
              </span>
              {savedResults.map((result) => {
                const risk = result.riskLevel ? RISK_CONFIG[result.riskLevel] : null;
                return (
                  <div key={result.id} className="rounded-md border p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight line-clamp-2">{result.title}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {result.externalUrl && (
                          <a href={result.externalUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                        <button onClick={() => handleDelete(result.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                      {result.externalPatentNumber && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{result.externalPatentNumber}</Badge>
                      )}
                      {risk && (
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${risk.className}`}>
                          {risk.label}
                        </Badge>
                      )}
                      {result.assignee && <span>{result.assignee}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">Include in IDS</span>
                      <Switch
                        checked={!!result.addedToIds}
                        onCheckedChange={() => handleToggleIDS(result.id, result.addedToIds)}
                        className="scale-75"
                      />
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="text-center py-8 space-y-2">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Search for prior art to compare against your patent
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

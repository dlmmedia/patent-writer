"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Wand2,
  Save,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Scale,
  Loader2,
  Hash,
  Sparkles,
  Eye,
  ListOrdered,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { createClaim, updateClaim, deleteClaim } from "@/lib/actions/patents";
import { modelInfo, type ModelId } from "@/lib/ai/providers";
import type { PatentClaim, ClaimType } from "@/lib/types";

type PatentWithClaims = {
  id: string;
  title: string;
  inventionDescription: string | null;
  technologyArea: string | null;
  jurisdiction: string;
  aiModelConfig: {
    draftingModel: string;
    claimsModel: string;
    analysisModel: string;
    imageModel: string;
  } | null;
  claims: PatentClaim[];
};

interface ClaimsBuilderClientProps {
  patent: PatentWithClaims;
}

const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  method: "Method",
  system: "System",
  apparatus: "Apparatus",
  composition: "Composition",
  computer_readable_medium: "CRM",
  means_plus_function: "Means+Function",
};

const CLAIM_TYPE_COLORS: Record<ClaimType, string> = {
  method:
    "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
  system:
    "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800",
  apparatus:
    "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800",
  composition:
    "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400 dark:border-yellow-800",
  computer_readable_medium:
    "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400 dark:border-orange-800",
  means_plus_function:
    "bg-rose-500/10 text-rose-700 border-rose-200 dark:text-rose-400 dark:border-rose-800",
};

const TRANSITIONAL_PHRASES = [
  { value: "comprising", label: "Comprising (open-ended)" },
  { value: "consisting of", label: "Consisting of (closed)" },
  {
    value: "consisting essentially of",
    label: "Consisting essentially of (semi-open)",
  },
];

export function ClaimsBuilderClient({ patent }: ClaimsBuilderClientProps) {
  const [claims, setClaims] = useState<PatentClaim[]>(patent.claims);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    claims[0]?.id ?? null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(claims.filter((c) => c.isIndependent).map((c) => c.id))
  );

  const [aiModel, setAiModel] = useState(() => {
    const stored = patent.aiModelConfig?.claimsModel;
    if (stored && ["gemini-3.1-pro","gemini-2.5-flash","gemini-2.5-pro","gpt-4o-mini","gpt-4o","o3","o4-mini"].includes(stored)) return stored;
    return "gemini-3.1-pro";
  });
  const [aiClaimType, setAiClaimType] = useState<ClaimType>("method");
  const [aiClaimCount, setAiClaimCount] = useState("3");
  const [aiInstructions, setAiInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedClaims, setGeneratedClaims] = useState<
    Array<{
      claimType: ClaimType;
      isIndependent: boolean;
      preamble: string;
      body: string;
      transitionalPhrase: string;
    }>
  >([]);
  const [expandedPreviews, setExpandedPreviews] = useState<Set<number>>(
    () => new Set()
  );

  const [editForm, setEditForm] = useState<{
    claimType: ClaimType;
    isIndependent: boolean;
    parentClaimId: string | null;
    transitionalPhrase: string;
    preamble: string;
    body: string;
  } | null>(null);

  const selectedClaim = useMemo(
    () => claims.find((c) => c.id === selectedClaimId) ?? null,
    [claims, selectedClaimId]
  );

  const independentClaims = useMemo(
    () => claims.filter((c) => c.isIndependent),
    [claims]
  );

  const dependentClaims = useMemo(
    () => claims.filter((c) => !c.isIndependent),
    [claims]
  );

  const childrenMap = useMemo(() => {
    const map = new Map<string, PatentClaim[]>();
    for (const claim of dependentClaims) {
      if (claim.parentClaimId) {
        const existing = map.get(claim.parentClaimId) ?? [];
        existing.push(claim);
        map.set(claim.parentClaimId, existing);
      }
    }
    return map;
  }, [dependentClaims]);

  const orphanClaims = useMemo(
    () =>
      dependentClaims.filter(
        (c) =>
          !c.parentClaimId || !claims.find((p) => p.id === c.parentClaimId)
      ),
    [dependentClaims, claims]
  );

  const fullTextPreview = useMemo(() => {
    if (!editForm) return "";
    const parts: string[] = [];
    if (editForm.preamble) parts.push(editForm.preamble.trim());
    if (editForm.transitionalPhrase) parts.push(editForm.transitionalPhrase);
    if (editForm.body) parts.push(editForm.body.trim());
    return parts.join(" ");
  }, [editForm]);

  const selectClaim = useCallback((claim: PatentClaim) => {
    setSelectedClaimId(claim.id);
    setEditForm({
      claimType: claim.claimType as ClaimType,
      isIndependent: claim.isIndependent,
      parentClaimId: claim.parentClaimId,
      transitionalPhrase: claim.transitionalPhrase ?? "comprising",
      preamble: claim.preamble ?? "",
      body: claim.body ?? "",
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!selectedClaim || !editForm) return;
    setIsSaving(true);
    try {
      const fullText = fullTextPreview || selectedClaim.fullText;
      const updated = await updateClaim(selectedClaim.id, {
        claimType: editForm.claimType,
        isIndependent: editForm.isIndependent,
        parentClaimId: editForm.isIndependent ? null : editForm.parentClaimId,
        transitionalPhrase: editForm.transitionalPhrase,
        preamble: editForm.preamble,
        body: editForm.body,
        fullText,
      });
      setClaims((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      toast.success(`Claim ${selectedClaim.claimNumber} saved`);
    } catch {
      toast.error("Failed to save claim");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClaim) return;
    setIsDeleting(true);
    try {
      await deleteClaim(selectedClaim.id, patent.id);
      setClaims((prev) => prev.filter((c) => c.id !== selectedClaim.id));
      setSelectedClaimId(null);
      setEditForm(null);
      setDeleteDialogOpen(false);
      toast.success(`Claim ${selectedClaim.claimNumber} deleted`);
    } catch {
      toast.error("Failed to delete claim");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddClaim = async () => {
    setIsAdding(true);
    const nextNumber =
      claims.length > 0
        ? Math.max(...claims.map((c) => c.claimNumber)) + 1
        : 1;
    try {
      const newClaim = await createClaim({
        patentId: patent.id,
        claimNumber: nextNumber,
        claimType: "method",
        isIndependent: true,
        fullText: "",
        preamble: "",
        body: "",
        transitionalPhrase: "comprising",
      });
      setClaims((prev) =>
        [...prev, newClaim].sort((a, b) => a.claimNumber - b.claimNumber)
      );
      selectClaim(newClaim);
      setExpandedNodes((prev) => new Set([...prev, newClaim.id]));
      toast.success(`Claim ${nextNumber} added`);
    } catch {
      toast.error("Failed to add claim");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRenumber = async () => {
    const sorted = [...claims].sort((a, b) => a.claimNumber - b.claimNumber);
    try {
      const updated: PatentClaim[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const claim = sorted[i];
        if (claim.claimNumber !== i + 1) {
          const result = await updateClaim(claim.id, {
            claimNumber: i + 1,
          });
          updated.push(result);
        } else {
          updated.push(claim);
        }
      }
      setClaims(updated);
      toast.success("Claims renumbered");
    } catch {
      toast.error("Failed to renumber claims");
    }
  };

  const handleGenerate = async () => {
    if (!patent.inventionDescription?.trim()) {
      toast.error(
        "Please add an invention description to your patent before generating claims."
      );
      return;
    }

    setIsGenerating(true);
    setGeneratedClaims([]);
    setExpandedPreviews(new Set());
    try {
      const response = await fetch("/api/ai/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patentId: patent.id,
          model: aiModel,
          claimType: aiClaimType,
          count: parseInt(aiClaimCount, 10),
          instructions: aiInstructions,
          inventionDescription: patent.inventionDescription,
          technologyArea: patent.technologyArea,
          jurisdiction: patent.jurisdiction,
          existingClaims: claims.map((c) => ({
            claimNumber: c.claimNumber,
            claimType: c.claimType,
            isIndependent: c.isIndependent,
            fullText: c.fullText,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setGeneratedClaims(data.claims ?? []);
      toast.success(`Generated ${data.claims?.length ?? 0} claims`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to generate claims: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddGenerated = async (
    generated: (typeof generatedClaims)[number]
  ) => {
    const nextNumber =
      claims.length > 0
        ? Math.max(...claims.map((c) => c.claimNumber)) + 1
        : 1;

    const fullText = [
      generated.preamble,
      generated.transitionalPhrase,
      generated.body,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const newClaim = await createClaim({
        patentId: patent.id,
        claimNumber: nextNumber,
        claimType: generated.claimType,
        isIndependent: generated.isIndependent,
        fullText,
        preamble: generated.preamble,
        body: generated.body,
        transitionalPhrase: generated.transitionalPhrase,
      });
      setClaims((prev) =>
        [...prev, newClaim].sort((a, b) => a.claimNumber - b.claimNumber)
      );
      setGeneratedClaims((prev) => prev.filter((g) => g !== generated));
      toast.success(`Added as Claim ${nextNumber}`);
    } catch {
      toast.error("Failed to add generated claim");
    }
  };

  const handleAddAllGenerated = async () => {
    for (const g of [...generatedClaims]) {
      await handleAddGenerated(g);
    }
  };

  const currentModelInfo = modelInfo[aiModel as ModelId];

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Scale className="size-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Claims Builder
            </h2>
            <p className="text-xs text-muted-foreground">
              {claims.length} total &middot; {independentClaims.length}{" "}
              independent &middot; {dependentClaims.length} dependent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRenumber}
            disabled={claims.length === 0}
          >
            <ListOrdered className="mr-1.5 size-3.5" />
            Renumber
          </Button>
          <Button size="sm" onClick={handleAddClaim} disabled={isAdding}>
            {isAdding ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 size-3.5" />
            )}
            Add Claim
          </Button>
        </div>
      </div>

      {/* Main Panels */}
      <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full w-full min-h-0 min-w-0"
        >
          {/* Left Panel: Claim Tree */}
          <ResizablePanel defaultSize={32} minSize={20} maxSize={50}>
            <div className="flex h-full min-w-0 flex-col border-r overflow-hidden">
              <div className="shrink-0 border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Claim Tree</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select a claim to edit
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-3 space-y-0.5">
                  {claims.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Scale className="size-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No claims yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                        Add a claim manually or generate with AI
                      </p>
                      <Button size="sm" onClick={handleAddClaim}>
                        <Plus className="mr-1.5 size-3.5" />
                        Add First Claim
                      </Button>
                    </div>
                  ) : (
                    <>
                      {independentClaims.map((root) => (
                        <ClaimTreeNode
                          key={root.id}
                          claim={root}
                          children={childrenMap.get(root.id) ?? []}
                          selectedId={selectedClaimId}
                          onSelect={selectClaim}
                          childrenMap={childrenMap}
                          expandedNodes={expandedNodes}
                          onToggleExpand={toggleExpanded}
                          depth={0}
                        />
                      ))}
                      {orphanClaims.map((orphan) => (
                        <ClaimTreeNode
                          key={orphan.id}
                          claim={orphan}
                          children={[]}
                          selectedId={selectedClaimId}
                          onSelect={selectClaim}
                          childrenMap={childrenMap}
                          expandedNodes={expandedNodes}
                          onToggleExpand={toggleExpanded}
                          isOrphan
                          depth={0}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Editor + AI */}
          <ResizablePanel defaultSize={68} minSize={45}>
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                <div className="p-4 space-y-6 min-w-0">
                  {/* Claim Editor */}
                  {selectedClaim && editForm ? (
                    <Card>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">
                              Claim {selectedClaim.claimNumber}
                            </CardTitle>
                            <CardDescription>
                              Edit claim details and content
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Dialog
                              open={deleteDialogOpen}
                              onOpenChange={setDeleteDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Claim</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to delete Claim{" "}
                                    {selectedClaim.claimNumber}? This action
                                    cannot be undone.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setDeleteDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting && (
                                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                    )}
                                    Delete
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              onClick={handleSave}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                              ) : (
                                <Save className="mr-1.5 size-3.5" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Row 1: Claim Number + Type */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Claim Number</Label>
                            <Input
                              value={selectedClaim.claimNumber}
                              readOnly
                              className="bg-muted/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Claim Type</Label>
                            <Select
                              value={editForm.claimType}
                              onValueChange={(v) =>
                                setEditForm((f) =>
                                  f
                                    ? { ...f, claimType: v as ClaimType }
                                    : f
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CLAIM_TYPE_LABELS).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Row 2: Independent toggle + Parent */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">
                              Independent Claim
                            </Label>
                            <div className="flex items-center gap-2 pt-1">
                              <Switch
                                checked={editForm.isIndependent}
                                onCheckedChange={(checked) =>
                                  setEditForm((f) =>
                                    f
                                      ? {
                                          ...f,
                                          isIndependent: checked,
                                          parentClaimId: checked
                                            ? null
                                            : f.parentClaimId,
                                        }
                                      : f
                                  )
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {editForm.isIndependent
                                  ? "Independent"
                                  : "Dependent"}
                              </span>
                            </div>
                          </div>
                          {!editForm.isIndependent && (
                            <div className="space-y-2">
                              <Label className="text-xs">Parent Claim</Label>
                              <Select
                                value={editForm.parentClaimId ?? ""}
                                onValueChange={(v) =>
                                  setEditForm((f) =>
                                    f ? { ...f, parentClaimId: v } : f
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select parent..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {independentClaims
                                    .filter(
                                      (c) => c.id !== selectedClaim.id
                                    )
                                    .map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        Claim {c.claimNumber} (
                                        {
                                          CLAIM_TYPE_LABELS[
                                            c.claimType as ClaimType
                                          ]
                                        }
                                        )
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {/* Transitional Phrase */}
                        <div className="space-y-2">
                          <Label className="text-xs">
                            Transitional Phrase
                          </Label>
                          <Select
                            value={editForm.transitionalPhrase}
                            onValueChange={(v) =>
                              setEditForm((f) =>
                                f ? { ...f, transitionalPhrase: v } : f
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRANSITIONAL_PHRASES.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Preamble */}
                        <div className="space-y-2">
                          <Label className="text-xs">Preamble</Label>
                          <Textarea
                            value={editForm.preamble}
                            onChange={(e) =>
                              setEditForm((f) =>
                                f
                                  ? { ...f, preamble: e.target.value }
                                  : f
                              )
                            }
                            placeholder="A method for processing data, the method..."
                            className="min-h-[80px] text-sm"
                          />
                        </div>

                        {/* Body */}
                        <div className="space-y-2">
                          <Label className="text-xs">Body</Label>
                          <Textarea
                            value={editForm.body}
                            onChange={(e) =>
                              setEditForm((f) =>
                                f ? { ...f, body: e.target.value } : f
                              )
                            }
                            placeholder={`receiving, by a processor, input data from a source;\ntransforming the input data using a trained model;\noutputting a result based on the transformation.`}
                            className="min-h-[200px] text-sm font-mono leading-relaxed"
                          />
                        </div>

                        <Separator />

                        {/* Full Text Preview */}
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1.5">
                            <Eye className="size-3" />
                            Full Text Preview
                          </Label>
                          <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {fullTextPreview || (
                                <span className="text-muted-foreground italic">
                                  Fill in the preamble and body to see the
                                  full claim text.
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Scores */}
                        {(selectedClaim.noveltyScore !== null ||
                          selectedClaim.breadthScore !== null) && (
                          <>
                            <Separator />
                            <div className="flex items-center gap-4">
                              {selectedClaim.noveltyScore !== null && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">
                                    Novelty:
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {(
                                      selectedClaim.noveltyScore * 100
                                    ).toFixed(0)}
                                    %
                                  </Badge>
                                </div>
                              )}
                              {selectedClaim.breadthScore !== null && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">
                                    Breadth:
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {(
                                      selectedClaim.breadthScore * 100
                                    ).toFixed(0)}
                                    %
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <Scale className="size-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Select a claim from the tree to edit
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Or add a new claim to get started
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <Separator />

                  {/* AI Generation Panel */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wand2 className="size-4" />
                        AI Claim Generator
                      </CardTitle>
                      <CardDescription>
                        Generate patent claims from your invention description
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Invention context */}
                      {patent.inventionDescription ? (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="flex items-start gap-2">
                            <Info className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              <span className="font-medium text-foreground">
                                Invention:
                              </span>{" "}
                              {patent.inventionDescription}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Add an invention description to your patent to
                              enable AI claim generation.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Model</Label>
                          <Select value={aiModel} onValueChange={setAiModel}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.entries(modelInfo) as [
                                  ModelId,
                                  (typeof modelInfo)[ModelId],
                                ][]
                              ).map(([id, info]) => (
                                <SelectItem key={id} value={id}>
                                  {info.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentModelInfo && (
                            <p className="text-[10px] text-muted-foreground">
                              {currentModelInfo.provider}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Claim Type</Label>
                          <Select
                            value={aiClaimType}
                            onValueChange={(v) =>
                              setAiClaimType(v as ClaimType)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CLAIM_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Count</Label>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={aiClaimCount}
                            onChange={(e) => setAiClaimCount(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">
                          Additional Instructions
                        </Label>
                        <Textarea
                          value={aiInstructions}
                          onChange={(e) => setAiInstructions(e.target.value)}
                          placeholder="e.g., Focus on the data processing pipeline, include dependent claims for specific embodiments..."
                          className="min-h-[80px] text-sm"
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleGenerate}
                        disabled={
                          isGenerating ||
                          !patent.inventionDescription?.trim()
                        }
                      >
                        {isGenerating ? (
                          <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 size-4" />
                        )}
                        Generate Claims
                      </Button>

                      {/* Loading skeleton */}
                      {isGenerating && (
                        <div className="space-y-3">
                          {Array.from({
                            length: parseInt(aiClaimCount, 10) || 3,
                          }).map((_, i) => (
                            <div
                              key={i}
                              className="rounded-md border p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16" />
                              </div>
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-4/5" />
                              <Skeleton className="h-3 w-3/5" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Generated claims preview */}
                      {generatedClaims.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Eye className="size-3.5 text-muted-foreground" />
                              <p className="text-xs font-medium">
                                Preview ({generatedClaims.length} generated)
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleAddAllGenerated}
                            >
                              <Plus className="mr-1 size-3" />
                              Add All
                            </Button>
                          </div>
                          {generatedClaims.map((generated, idx) => {
                            const isPreviewExpanded = expandedPreviews.has(idx);
                            const fullText = [
                              generated.preamble,
                              generated.transitionalPhrase,
                              generated.body,
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return (
                              <div
                                key={idx}
                                className="rounded-md border bg-muted/20 p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${CLAIM_TYPE_COLORS[generated.claimType] ?? ""}`}
                                    >
                                      {CLAIM_TYPE_LABELS[
                                        generated.claimType
                                      ] ?? generated.claimType}
                                    </Badge>
                                    <Badge
                                      variant={
                                        generated.isIndependent
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-[10px]"
                                    >
                                      {generated.isIndependent
                                        ? "Independent"
                                        : "Dependent"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setExpandedPreviews((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(idx)) {
                                            next.delete(idx);
                                          } else {
                                            next.add(idx);
                                          }
                                          return next;
                                        })
                                      }
                                    >
                                      <Eye className="mr-1 size-3" />
                                      {isPreviewExpanded
                                        ? "Collapse"
                                        : "Preview"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleAddGenerated(generated)
                                      }
                                    >
                                      <Plus className="mr-1 size-3" />
                                      Add
                                    </Button>
                                  </div>
                                </div>
                                {isPreviewExpanded ? (
                                  <div className="rounded-md border bg-background p-3">
                                    <p className="text-xs leading-relaxed whitespace-pre-wrap">
                                      {fullText}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                    {fullText}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function ClaimTreeNode({
  claim,
  children,
  selectedId,
  onSelect,
  childrenMap,
  expandedNodes,
  onToggleExpand,
  isOrphan = false,
  depth = 0,
}: {
  claim: PatentClaim;
  children: PatentClaim[];
  selectedId: string | null;
  onSelect: (claim: PatentClaim) => void;
  childrenMap: Map<string, PatentClaim[]>;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  isOrphan?: boolean;
  depth?: number;
}) {
  const isSelected = selectedId === claim.id;
  const claimType = claim.claimType as ClaimType;
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodes.has(claim.id);

  return (
    <div>
      <button
        onClick={() => onSelect(claim)}
        className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
          isSelected
            ? "bg-accent text-accent-foreground"
            : "hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(claim.id);
            }}
            className="shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
          </button>
        ) : depth > 0 ? (
          <span className="size-3 shrink-0" />
        ) : null}

        <Hash className="size-3 text-muted-foreground shrink-0" />

        <span
          className={`flex-1 truncate ${
            claim.isIndependent ? "font-semibold" : "font-normal"
          }`}
        >
          {claim.claimNumber}.{" "}
          {claim.fullText
            ? claim.fullText.slice(0, 50) +
              (claim.fullText.length > 50 ? "..." : "")
            : "(empty)"}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {isOrphan && <AlertTriangle className="size-3 text-amber-500" />}
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${CLAIM_TYPE_COLORS[claimType] ?? ""}`}
          >
            {CLAIM_TYPE_LABELS[claimType]?.split(" ")[0] ?? claimType}
          </Badge>
        </div>
      </button>

      {hasChildren && isExpanded && (
        <div
          className="border-l-2 border-muted-foreground/20"
          style={{ marginLeft: `${22 + depth * 20}px` }}
        >
          {children.map((child) => (
            <ClaimTreeNode
              key={child.id}
              claim={child}
              children={childrenMap.get(child.id) ?? []}
              selectedId={selectedId}
              onSelect={onSelect}
              childrenMap={childrenMap}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

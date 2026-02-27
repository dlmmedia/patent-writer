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
  AlertTriangle,
  Scale,
  Loader2,
  Hash,
  Sparkles,
  Eye,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { createClaim, updateClaim, deleteClaim } from "@/lib/actions/patents";
import type { PatentClaim, ClaimType } from "@/lib/types";

type PatentWithClaims = {
  id: string;
  title: string;
  inventionDescription: string | null;
  technologyArea: string | null;
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
  computer_readable_medium: "Computer Readable Medium",
  means_plus_function: "Means + Function",
};

const CLAIM_TYPE_COLORS: Record<ClaimType, string> = {
  method: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
  system: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800",
  apparatus: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800",
  composition: "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400 dark:border-yellow-800",
  computer_readable_medium: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400 dark:border-orange-800",
  means_plus_function: "bg-rose-500/10 text-rose-700 border-rose-200 dark:text-rose-400 dark:border-rose-800",
};

const TRANSITIONAL_PHRASES = [
  { value: "comprising", label: "Comprising (open-ended)" },
  { value: "consisting of", label: "Consisting of (closed)" },
  { value: "consisting essentially of", label: "Consisting essentially of (semi-open)" },
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

  // AI generation state
  const [aiModel, setAiModel] = useState(
    patent.aiModelConfig?.claimsModel ?? "gpt-5.2"
  );
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

  // Editor form state
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

  const claimTree = useMemo(() => {
    const roots = independentClaims;
    const childrenMap = new Map<string, PatentClaim[]>();

    for (const claim of dependentClaims) {
      const parentId = claim.parentClaimId;
      if (parentId) {
        const existing = childrenMap.get(parentId) ?? [];
        existing.push(claim);
        childrenMap.set(parentId, existing);
      }
    }

    return { roots, childrenMap };
  }, [independentClaims, dependentClaims]);

  const selectClaim = useCallback(
    (claim: PatentClaim) => {
      setSelectedClaimId(claim.id);
      setEditForm({
        claimType: claim.claimType as ClaimType,
        isIndependent: claim.isIndependent,
        parentClaimId: claim.parentClaimId,
        transitionalPhrase: claim.transitionalPhrase ?? "comprising",
        preamble: claim.preamble ?? "",
        body: claim.body ?? "",
      });
    },
    []
  );

  const fullTextPreview = useMemo(() => {
    if (!editForm) return "";
    const parts: string[] = [];
    if (editForm.preamble) parts.push(editForm.preamble.trim());
    if (editForm.transitionalPhrase) parts.push(editForm.transitionalPhrase);
    if (editForm.body) parts.push(editForm.body.trim());
    return parts.join(" ");
  }, [editForm]);

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
    setIsGenerating(true);
    setGeneratedClaims([]);
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

  return (
    <div className="flex h-full flex-col" style={{ height: "100%" }}>
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
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <ResizablePanelGroup orientation="horizontal" style={{ height: "100%", width: "100%" }}>
          {/* Left Panel: Claim Tree */}
          <ResizablePanel defaultSize={40} minSize={25} maxSize={55}>
            <div className="flex h-full flex-col border-r">
              <div className="shrink-0 border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Claim Tree</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select a claim to edit
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-3 space-y-1">
                  {claims.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Scale className="size-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No claims yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Add a claim or generate with AI
                      </p>
                    </div>
                  ) : (
                    claimTree.roots.map((root) => (
                      <ClaimTreeNode
                        key={root.id}
                        claim={root}
                        children={claimTree.childrenMap.get(root.id) ?? []}
                        selectedId={selectedClaimId}
                        onSelect={selectClaim}
                        allClaims={claims}
                        childrenMap={claimTree.childrenMap}
                      />
                    ))
                  )}

                  {dependentClaims
                    .filter(
                      (c) =>
                        !c.parentClaimId ||
                        !claims.find((p) => p.id === c.parentClaimId)
                    )
                    .map((orphan) => (
                      <ClaimTreeNode
                        key={orphan.id}
                        claim={orphan}
                        children={[]}
                        selectedId={selectedClaimId}
                        onSelect={selectClaim}
                        allClaims={claims}
                        childrenMap={claimTree.childrenMap}
                        isOrphan
                      />
                    ))}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Editor + AI */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="flex h-full flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4 space-y-6">
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
                          <Label className="text-xs">Independent Claim</Label>
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
                                <SelectValue placeholder="Select parent…" />
                              </SelectTrigger>
                              <SelectContent>
                                {independentClaims
                                  .filter(
                                    (c) => c.id !== selectedClaim.id
                                  )
                                  .map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      Claim {c.claimNumber} (
                                      {CLAIM_TYPE_LABELS[c.claimType as ClaimType]})
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
                          placeholder="A method for processing data, the method…"
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
                          placeholder="receiving, by a processor, input data from a source;&#10;transforming the input data using a trained model;&#10;outputting a result based on the transformation."
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
                                <Badge variant="outline" className="text-xs">
                                  {(selectedClaim.noveltyScore * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            )}
                            {selectedClaim.breadthScore !== null && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">
                                  Breadth:
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {(selectedClaim.breadthScore * 100).toFixed(0)}%
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
                      Use AI to draft patent claims based on your invention
                      description
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Model</Label>
                        <Select value={aiModel} onValueChange={setAiModel}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                            <SelectItem value="gpt-5-mini">
                              GPT-5 Mini
                            </SelectItem>
                            <SelectItem value="gemini-2.5-pro">
                              Gemini 2.5 Pro
                            </SelectItem>
                            <SelectItem value="gemini-2.5-flash">
                              Gemini 2.5 Flash
                            </SelectItem>
                          </SelectContent>
                        </Select>
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
                        placeholder="e.g., Focus on the data processing pipeline, include dependent claims for specific embodiments…"
                        className="min-h-[80px] text-sm"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleGenerate}
                      disabled={isGenerating}
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
                        {Array.from({ length: parseInt(aiClaimCount, 10) || 3 }).map(
                          (_, i) => (
                            <div key={i} className="rounded-md border p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16" />
                              </div>
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-4/5" />
                              <Skeleton className="h-3 w-3/5" />
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Generated claims preview */}
                    {generatedClaims.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            {generatedClaims.length} generated — review
                            and add
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              for (const g of generatedClaims) {
                                await handleAddGenerated(g);
                              }
                            }}
                          >
                            <Plus className="mr-1 size-3" />
                            Add All
                          </Button>
                        </div>
                        {generatedClaims.map((generated, idx) => (
                          <div
                            key={idx}
                            className="rounded-md border p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${CLAIM_TYPE_COLORS[generated.claimType]}`}
                                >
                                  {CLAIM_TYPE_LABELS[generated.claimType]}
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddGenerated(generated)}
                              >
                                <Plus className="mr-1 size-3" />
                                Add
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                              {generated.preamble}{" "}
                              {generated.transitionalPhrase}{" "}
                              {generated.body}
                            </p>
                          </div>
                        ))}
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
    </div>
  );
}

function ClaimTreeNode({
  claim,
  children,
  selectedId,
  onSelect,
  allClaims,
  childrenMap,
  isOrphan = false,
  depth = 0,
}: {
  claim: PatentClaim;
  children: PatentClaim[];
  selectedId: string | null;
  onSelect: (claim: PatentClaim) => void;
  allClaims: PatentClaim[];
  childrenMap: Map<string, PatentClaim[]>;
  isOrphan?: boolean;
  depth?: number;
}) {
  const isSelected = selectedId === claim.id;
  const claimType = claim.claimType as ClaimType;

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
        {children.length > 0 && (
          <ChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
        {children.length === 0 && depth > 0 && (
          <span className="size-3 shrink-0" />
        )}

        <Hash className="size-3 text-muted-foreground shrink-0" />

        <span
          className={`flex-1 truncate ${
            claim.isIndependent ? "font-semibold" : "font-normal"
          }`}
        >
          {claim.claimNumber}.{" "}
          {claim.fullText
            ? claim.fullText.slice(0, 60) +
              (claim.fullText.length > 60 ? "…" : "")
            : "(empty)"}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {isOrphan && (
            <AlertTriangle className="size-3 text-amber-500" />
          )}
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${CLAIM_TYPE_COLORS[claimType]}`}
          >
            {CLAIM_TYPE_LABELS[claimType]?.split(" ")[0]}
          </Badge>
          {claim.noveltyScore !== null && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              N:{(claim.noveltyScore * 100).toFixed(0)}
            </Badge>
          )}
          {claim.breadthScore !== null && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              B:{(claim.breadthScore * 100).toFixed(0)}
            </Badge>
          )}
        </div>
      </button>

      {children.map((child) => (
        <ClaimTreeNode
          key={child.id}
          claim={child}
          children={childrenMap.get(child.id) ?? []}
          selectedId={selectedId}
          onSelect={onSelect}
          allClaims={allClaims}
          childrenMap={childrenMap}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Check,
  Download,
  Hash,
  Image,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { PatentDrawing, ReferenceNumeral } from "@/lib/types";
import { VersionHistory } from "./version-history";
import type { PlacedNumeral, VersionEntry } from "./drawing-types";

interface WorkspacePanelProps {
  drawing: PatentDrawing;
  numerals: ReferenceNumeral[];
  placedNumerals: PlacedNumeral[];
  onSaveDetails: (data: {
    figureNumber: string;
    figureLabel: string;
    description: string;
    annotations: {
      numerals: { id: string; numeral: number; x: number; y: number; elementName: string }[];
      arrows: { id: string; fromX: number; fromY: number; toX: number; toY: number }[];
    };
  }) => Promise<void>;
  onPlaceNumeral: (numeral: number, elementName: string) => void;
  onRemovePlacedNumeral: (id: string) => void;
  onImageClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  isPlacingNumeral: boolean;
  pendingNumeral: { numeral: number; elementName: string } | null;
  onCancelPlacing: () => void;
  onRegenerate: () => void;
  onEditDrawing: () => void;
  onExportPng: () => void;
  onProcess: () => void;
  onAddNumeral: (name: string, description: string) => Promise<void>;
  onDeleteNumeral: (id: string) => Promise<void>;
  onDeduplicateNumerals: () => Promise<void>;
  nextNumeral: number;
}

export function WorkspacePanel({
  drawing,
  numerals,
  placedNumerals,
  onSaveDetails,
  onPlaceNumeral,
  onRemovePlacedNumeral,
  onImageClick,
  isPlacingNumeral,
  pendingNumeral,
  onCancelPlacing,
  onRegenerate,
  onEditDrawing,
  onExportPng,
  onProcess,
  onAddNumeral,
  onDeleteNumeral,
  onDeduplicateNumerals,
  nextNumeral,
}: WorkspacePanelProps) {
  const [editFigureNumber, setEditFigureNumber] = useState(drawing.figureNumber);
  const [editFigureLabel, setEditFigureLabel] = useState(drawing.figureLabel);
  const [editDescription, setEditDescription] = useState(drawing.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [newNumeralName, setNewNumeralName] = useState("");
  const [newNumeralDesc, setNewNumeralDesc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  const versions: VersionEntry[] = (drawing.previousVersions as VersionEntry[] | null) ?? [];

  const uniqueNumerals = useMemo(() => {
    const seen = new Map<number, ReferenceNumeral>();
    for (const n of numerals) {
      if (!seen.has(n.numeral)) {
        seen.set(n.numeral, n);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.numeral - b.numeral);
  }, [numerals]);

  const hasDuplicates = numerals.length > uniqueNumerals.length;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const annotations = {
        numerals: placedNumerals.map((p) => ({
          id: p.id,
          numeral: p.numeral,
          x: p.xPercent,
          y: p.yPercent,
          elementName: p.elementName,
        })),
        arrows: drawing.annotations?.arrows ?? [],
      };
      await onSaveDetails({
        figureNumber: editFigureNumber,
        figureLabel: editFigureLabel,
        description: editDescription,
        annotations,
      });
      toast.success("Drawing details saved.");
    } catch {
      toast.error("Failed to save drawing details.");
    } finally {
      setIsSaving(false);
    }
  }, [editFigureNumber, editFigureLabel, editDescription, placedNumerals, drawing, onSaveDetails]);

  const handleAddNumeral = useCallback(async () => {
    if (!newNumeralName.trim()) {
      toast.error("Please enter an element name.");
      return;
    }
    await onAddNumeral(newNumeralName.trim(), newNumeralDesc.trim());
    setNewNumeralName("");
    setNewNumeralDesc("");
  }, [newNumeralName, newNumeralDesc, onAddNumeral]);

  const handleDeduplicate = useCallback(async () => {
    setIsDeduplicating(true);
    try {
      await onDeduplicateNumerals();
      toast.success("Duplicate numerals removed.");
    } catch {
      toast.error("Failed to remove duplicates.");
    } finally {
      setIsDeduplicating(false);
    }
  }, [onDeduplicateNumerals]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">
              FIG. {drawing.figureNumber} — {drawing.figureLabel}
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isPlacingNumeral && (
                <Badge variant="destructive" className="gap-1">
                  <Hash className="h-3 w-3" />
                  Click to place #{pendingNumeral?.numeral}
                  <button onClick={onCancelPlacing} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <div className="flex items-center gap-0.5 border rounded-md">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs w-10 text-center font-mono">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoom(1)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={onRegenerate}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={onEditDrawing}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={onProcess}>
                <Shield className="h-4 w-4 mr-1" />
                USPTO
              </Button>
              <Button variant="outline" size="sm" onClick={onExportPng}>
                <Download className="h-4 w-4 mr-1" />
                PNG
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[70vh] rounded-lg border bg-white">
            <div
              onClick={onImageClick}
              className={`relative transition-transform origin-top-left ${
                isPlacingNumeral ? "cursor-crosshair" : "cursor-default"
              }`}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            >
              {drawing.originalUrl ? (
                <img
                  src={drawing.originalUrl}
                  alt={drawing.figureLabel}
                  className="w-full"
                  draggable={false}
                />
              ) : (
                <div className="aspect-square flex items-center justify-center bg-muted">
                  <Image className="h-16 w-16 text-muted-foreground" />
                </div>
              )}

              {placedNumerals.map((pn) => (
                <div
                  key={pn.id}
                  className="absolute group/numeral"
                  style={{
                    left: `${pn.xPercent}%`,
                    top: `${pn.yPercent}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="bg-white border-2 border-black rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-sm">
                      {pn.numeral}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePlacedNumeral(pn.id);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/numeral:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover/numeral:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap border">
                      {pn.numeral} — {pn.elementName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Drawing Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Drawing Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Figure Number</Label>
              <Input
                value={editFigureNumber}
                onChange={(e) => setEditFigureNumber(e.target.value)}
                placeholder="e.g. 1, 2A"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Figure Label</Label>
              <Input
                value={editFigureLabel}
                onChange={(e) => setEditFigureLabel(e.target.value)}
                placeholder="e.g. Perspective View"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Describe what this figure shows..."
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Wand2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              {isSaving ? "Saving..." : "Save Details"}
            </Button>
          </CardContent>
        </Card>

        {/* Annotations - place numerals on the drawing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Annotations
            </CardTitle>
            <CardDescription className="text-xs">
              Place reference numerals on the drawing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {uniqueNumerals.length > 0 && (
              <ScrollArea className="h-40">
                <div className="space-y-1 pr-3">
                  {uniqueNumerals.map((n) => {
                    const isPlaced = placedNumerals.some(
                      (p) => p.numeral === n.numeral
                    );
                    return (
                      <div
                        key={n.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-semibold text-xs w-8 shrink-0">
                            {n.numeral}
                          </span>
                          <span className="truncate text-xs">
                            {n.elementName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isPlaced ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5"
                            >
                              Placed
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() =>
                                onPlaceNumeral(n.numeral, n.elementName)
                              }
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Place
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {placedNumerals.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Placed on this figure
                  </p>
                  <div className="space-y-1">
                    {placedNumerals.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/50 text-xs"
                      >
                        <span>
                          <span className="font-mono font-semibold">
                            {p.numeral}
                          </span>{" "}
                          — {p.elementName}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => onRemovePlacedNumeral(p.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Reference Numerals - manage the master list */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Reference Numerals
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {uniqueNumerals.length} unique numeral{uniqueNumerals.length !== 1 && "s"}
                  {hasDuplicates && (
                    <span className="text-amber-600 ml-1">
                      ({numerals.length - uniqueNumerals.length} duplicates)
                    </span>
                  )}
                </CardDescription>
              </div>
              {hasDuplicates && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleDeduplicate}
                  disabled={isDeduplicating}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {isDeduplicating ? "Cleaning..." : "Clean up"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-mono">
                  {nextNumeral}
                </Badge>
                <Input
                  value={newNumeralName}
                  onChange={(e) => setNewNumeralName(e.target.value)}
                  placeholder="Element name"
                  className="text-sm"
                />
              </div>
              <Input
                value={newNumeralDesc}
                onChange={(e) => setNewNumeralDesc(e.target.value)}
                placeholder="Description (optional)"
                className="text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleAddNumeral}
                disabled={!newNumeralName.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Numeral
              </Button>
            </div>

            {uniqueNumerals.length > 0 && (
              <>
                <Separator />
                <ScrollArea className="h-48">
                  <div className="space-y-1.5 pr-3">
                    {uniqueNumerals.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-md border px-3 py-2 group/item"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-sm shrink-0">
                              {n.numeral}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {n.elementName}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
                            onClick={() => onDeleteNumeral(n.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                        {n.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {n.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>

        <VersionHistory versions={versions} />
      </div>
    </div>
  );
}

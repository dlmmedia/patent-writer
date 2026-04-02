"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  DRAWING_TYPE_LABELS,
  DRAWING_TYPE_GROUPS,
  type DrawingType,
} from "@/lib/ai/drawing-prompts";
import type { PatentDrawing } from "@/lib/types";
import type { ImageModelId } from "./drawing-types";
import { IMAGE_MODEL_OPTIONS } from "./drawing-types";

interface RegenerateDialogProps {
  drawing: PatentDrawing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (data: {
    drawingId: string;
    imageBase64: string;
    imageUrl: string;
    prompt: string;
    model: ImageModelId;
    figureType: DrawingType;
  }) => Promise<void>;
}

export function RegenerateDialog({
  drawing,
  open,
  onOpenChange,
  onAccept,
}: RegenerateDialogProps) {
  const [prompt, setPrompt] = useState(drawing.generationPrompt ?? drawing.description ?? "");
  const [model, setModel] = useState<ImageModelId>(
    (drawing.generationModel as ImageModelId) ?? "nano-banana-2"
  );
  const [figureType, setFigureType] = useState<DrawingType>(
    (drawing.figureType as DrawingType) ?? "block_diagram"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a description.");
      return;
    }
    setIsGenerating(true);
    setNewImage(null);
    setNewImageUrl(null);

    try {
      const res = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, figureType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");

      setNewImage(`data:image/png;base64,${data.image}`);
      setNewImageUrl(data.url);
      toast.success("New version generated!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Regeneration failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, model, figureType]);

  const handleAccept = useCallback(async () => {
    if (!newImage) return;
    setIsAccepting(true);
    try {
      await onAccept({
        drawingId: drawing.id,
        imageBase64: newImage,
        imageUrl: newImageUrl || newImage,
        prompt,
        model,
        figureType,
      });
      onOpenChange(false);
    } catch {
      toast.error("Failed to save regenerated drawing.");
    } finally {
      setIsAccepting(false);
    }
  }, [newImage, newImageUrl, prompt, model, figureType, drawing.id, onAccept, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Regenerate FIG. {drawing.figureNumber}
          </DialogTitle>
          <DialogDescription>
            Edit the prompt and regenerate. The old version will be kept in
            version history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Figure Type</Label>
              <Select
                value={figureType}
                onValueChange={(v) => setFigureType(v as DrawingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRAWING_TYPE_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.types.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DRAWING_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={model}
                onValueChange={(v) => setModel(v as ImageModelId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Current Version
              </Label>
              <div className="rounded-lg border overflow-hidden bg-white">
                {drawing.originalUrl ? (
                  <img
                    src={drawing.originalUrl}
                    alt="Current"
                    className="w-full aspect-square object-contain"
                  />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-muted text-muted-foreground text-sm">
                    No image
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                New Version
              </Label>
              <div className="rounded-lg border overflow-hidden bg-white">
                {isGenerating ? (
                  <Skeleton className="w-full aspect-square" />
                ) : newImage ? (
                  <img
                    src={newImage}
                    alt="New"
                    className="w-full aspect-square object-contain"
                  />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-muted text-muted-foreground text-sm">
                    Click Regenerate
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          {newImage && !isGenerating ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setNewImage(null);
                  setNewImageUrl(null);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleGenerate}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                className="flex-1"
                onClick={handleAccept}
                disabled={isAccepting}
              >
                <Check className="h-4 w-4 mr-2" />
                {isAccepting ? "Saving..." : "Accept"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

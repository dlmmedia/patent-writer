"use client";

import { useState, useCallback, useRef } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Wand2, Check, X, Upload, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  DRAWING_TYPE_LABELS,
  DRAWING_TYPE_GROUPS,
  type DrawingType,
} from "@/lib/ai/drawing-prompts";
import type { ImageModelId } from "./drawing-types";
import { IMAGE_MODEL_OPTIONS } from "./drawing-types";

interface GenerateDialogProps {
  defaultModel: ImageModelId;
  onAccept: (data: {
    imageBase64: string;
    imageUrl: string;
    description: string;
    model: ImageModelId;
    figureType: DrawingType;
  }) => Promise<void>;
}

export function GenerateDialog({
  defaultModel,
  onAccept,
}: GenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [model, setModel] = useState<ImageModelId>(defaultModel);
  const [figureType, setFigureType] = useState<DrawingType>("block_diagram");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [referenceImageBase64, setReferenceImageBase64] = useState<
    string | null
  >(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<
    string | null
  >(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  const handleReferenceImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file (PNG, JPG, or WebP).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Reference image must be under 10 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setReferenceImagePreview(dataUrl);
        setReferenceImageBase64(dataUrl.split(",")[1]);
      };
      reader.readAsDataURL(file);
      if (refImageInputRef.current) refImageInputRef.current.value = "";
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) {
      toast.error("Please enter a description for the drawing.");
      return;
    }
    setIsGenerating(true);
    setGeneratedImage(null);
    setGeneratedImageUrl(null);
    setGenerationError(null);

    try {
      const body: Record<string, unknown> = {
        prompt: description,
        model,
        figureType,
      };
      if (referenceImageBase64) body.referenceImage = referenceImageBase64;

      const res = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");

      setGeneratedImage(`data:image/png;base64,${data.image}`);
      setGeneratedImageUrl(data.url);
      toast.success("Drawing generated successfully!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setGenerationError(msg);
      toast.error(`Failed to generate drawing: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  }, [description, model, figureType, referenceImageBase64]);

  const handleAccept = useCallback(async () => {
    if (!generatedImage) return;
    setIsAccepting(true);
    try {
      await onAccept({
        imageBase64: generatedImage,
        imageUrl: generatedImageUrl || generatedImage,
        description,
        model,
        figureType,
      });
      setOpen(false);
      setGeneratedImage(null);
      setGeneratedImageUrl(null);
      setDescription("");
      setReferenceImageBase64(null);
      setReferenceImagePreview(null);
    } catch {
      toast.error("Failed to save drawing.");
    } finally {
      setIsAccepting(false);
    }
  }, [generatedImage, generatedImageUrl, description, model, figureType, onAccept]);

  const reset = () => {
    setReferenceImageBase64(null);
    setReferenceImagePreview(null);
    setGeneratedImage(null);
    setGeneratedImageUrl(null);
    setGenerationError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Drawing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Patent Drawing
          </DialogTitle>
          <DialogDescription>
            Describe the drawing and select a figure type and generation model.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the drawing in detail, e.g. 'A portable knee walker with four wheels, an adjustable knee rest pad, handlebars with brake levers, and a basket...'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

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

          <div className="space-y-2">
            <Label>Reference Image (optional)</Label>
            {referenceImagePreview ? (
              <div className="relative rounded-lg border overflow-hidden">
                <img
                  src={referenceImagePreview}
                  alt="Reference"
                  className="w-full max-h-40 object-contain bg-muted"
                />
                <button
                  onClick={() => {
                    setReferenceImageBase64(null);
                    setReferenceImagePreview(null);
                  }}
                  className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="text-[10px]">
                    <ImagePlus className="h-3 w-3 mr-1" />
                    Reference attached
                  </Badge>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Upload a reference image
                </div>
                <input
                  ref={refImageInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleReferenceImageUpload}
                />
              </label>
            )}
            <p className="text-[11px] text-muted-foreground">
              Upload an image to guide the AI in generating a similar-style
              drawing.
            </p>
          </div>

          {isGenerating && (
            <div className="space-y-3">
              <Skeleton className="w-full aspect-square rounded-lg" />
              <p className="text-sm text-muted-foreground text-center">
                Generating drawing...
              </p>
            </div>
          )}

          {generationError && !isGenerating && !generatedImage && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <X className="h-4 w-4" />
                Drawing generation failed
              </p>
              <p className="text-xs text-destructive/80">{generationError}</p>
            </div>
          )}

          {generatedImage && !isGenerating && (
            <div className="space-y-3">
              <div className="relative rounded-lg border overflow-hidden">
                <img
                  src={generatedImage}
                  alt="Generated drawing"
                  className="w-full"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Preview — click Accept to add to your drawings
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {generatedImage && !isGenerating ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setGeneratedImage(null);
                  setGeneratedImageUrl(null);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button
                className="flex-1"
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {isAccepting ? "Saving..." : "Accept & Save"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Drawing
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

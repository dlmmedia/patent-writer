"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { PatentDrawing } from "@/lib/types";
import type { ImageModelId } from "./drawing-types";
import { IMAGE_MODEL_OPTIONS } from "./drawing-types";

interface EditDrawingDialogProps {
  drawing: PatentDrawing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (data: {
    drawingId: string;
    imageBase64: string;
    imageUrl: string;
    editPrompt: string;
    model: ImageModelId;
  }) => Promise<void>;
}

export function EditDrawingDialog({
  drawing,
  open,
  onOpenChange,
  onAccept,
}: EditDrawingDialogProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [model, setModel] = useState<ImageModelId>("gpt-image-1");
  const [isEditing, setIsEditing] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleEdit = useCallback(async () => {
    if (!editPrompt.trim()) {
      toast.error("Please enter an edit instruction.");
      return;
    }
    if (!drawing.originalUrl) {
      toast.error("No source image available.");
      return;
    }
    setIsEditing(true);
    setEditedImage(null);
    setEditedImageUrl(null);

    try {
      let sourceBase64: string;
      if (drawing.originalUrl.startsWith("data:")) {
        sourceBase64 = drawing.originalUrl.split(",")[1];
      } else {
        const res = await fetch(drawing.originalUrl);
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        sourceBase64 = btoa(
          new Uint8Array(buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );
      }

      const res = await fetch("/api/ai/images/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage: sourceBase64,
          editPrompt,
          model,
          originalDescription: drawing.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Edit failed");

      setEditedImage(`data:image/png;base64,${data.image}`);
      setEditedImageUrl(data.url);
      toast.success("Edit applied successfully!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Edit failed: ${msg}`);
    } finally {
      setIsEditing(false);
    }
  }, [editPrompt, model, drawing]);

  const handleAccept = useCallback(async () => {
    if (!editedImage) return;
    setIsAccepting(true);
    try {
      await onAccept({
        drawingId: drawing.id,
        imageBase64: editedImage,
        imageUrl: editedImageUrl || editedImage,
        editPrompt,
        model,
      });
      onOpenChange(false);
      setEditPrompt("");
      setEditedImage(null);
      setEditedImageUrl(null);
    } catch {
      toast.error("Failed to save edited drawing.");
    } finally {
      setIsAccepting(false);
    }
  }, [editedImage, editedImageUrl, editPrompt, model, drawing.id, onAccept, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit FIG. {drawing.figureNumber}
          </DialogTitle>
          <DialogDescription>
            Describe what changes you want. The AI will modify the existing
            drawing. Previous version is preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Edit Instruction</Label>
            <Textarea
              placeholder='e.g. "Add a handle bar on top", "Remove the left wheel", "Add reference numeral 102 pointing to the seat"'
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={3}
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Before</Label>
              <div className="rounded-lg border overflow-hidden bg-white">
                {drawing.originalUrl ? (
                  <img
                    src={drawing.originalUrl}
                    alt="Before"
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
              <Label className="text-xs text-muted-foreground">After</Label>
              <div className="rounded-lg border overflow-hidden bg-white">
                {isEditing ? (
                  <Skeleton className="w-full aspect-square" />
                ) : editedImage ? (
                  <img
                    src={editedImage}
                    alt="After"
                    className="w-full aspect-square object-contain"
                  />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-muted text-muted-foreground text-sm">
                    Click Edit to apply changes
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          {editedImage && !isEditing ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditedImage(null);
                  setEditedImageUrl(null);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleEdit}
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
                {isAccepting ? "Saving..." : "Accept Edit"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleEdit}
              disabled={isEditing || !editPrompt.trim()}
              className="w-full"
            >
              {isEditing ? (
                <>
                  <Pencil className="h-4 w-4 mr-2 animate-spin" />
                  Applying edit...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Drawing
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

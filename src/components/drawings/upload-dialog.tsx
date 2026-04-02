"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Upload, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  DRAWING_TYPE_LABELS,
  DRAWING_TYPE_GROUPS,
  type DrawingType,
} from "@/lib/ai/drawing-prompts";

interface UploadDialogProps {
  onAccept: (data: {
    imageDataUrl: string;
    label: string;
    description: string;
    figureType: DrawingType;
  }) => Promise<void>;
}

export function UploadDialog({ onAccept }: UploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [figureType, setFigureType] = useState<DrawingType>("perspective_view");
  const [isAccepting, setIsAccepting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Image must be under 20 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    },
    []
  );

  const handleAccept = useCallback(async () => {
    if (!imagePreview) return;
    if (!label.trim()) {
      toast.error("Please enter a figure label.");
      return;
    }
    setIsAccepting(true);
    try {
      await onAccept({
        imageDataUrl: imagePreview,
        label,
        description,
        figureType,
      });
      setOpen(false);
      setImagePreview(null);
      setLabel("");
      setDescription("");
    } catch {
      toast.error("Failed to upload drawing.");
    } finally {
      setIsAccepting(false);
    }
  }, [imagePreview, label, description, figureType, onAccept]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setImagePreview(null);
          setLabel("");
          setDescription("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload Drawing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Patent Drawing
          </DialogTitle>
          <DialogDescription>
            Upload a hand-drawn sketch, scan, or existing illustration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {imagePreview ? (
            <div className="relative rounded-lg border overflow-hidden">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="w-full max-h-64 object-contain bg-muted"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">
                  Click to select an image
                </span>
                <span className="text-xs">PNG, JPG, WebP up to 20 MB</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
              />
            </label>
          )}

          <div className="space-y-2">
            <Label>Figure Label</Label>
            <Input
              placeholder="e.g. Perspective View of Mobility Walker"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
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
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Describe what this figure shows..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!imagePreview || !label.trim() || isAccepting}
            className="w-full"
          >
            {isAccepting ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Drawing
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

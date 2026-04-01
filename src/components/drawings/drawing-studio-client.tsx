"use client";

import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import type { Patent, PatentDrawing, ReferenceNumeral } from "@/lib/types";
import { createReferenceNumeral, createDrawing, updateDrawing } from "@/lib/actions/patents";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Image,
  Wand2,
  Download,
  Hash,
  Tag,
  Check,
  X,
  Pencil,
  ZoomIn,
  Trash2,
  Archive,
  Upload,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";

type DrawingType =
  | "flowchart"
  | "block_diagram"
  | "system_architecture"
  | "ui_mockup"
  | "data_flow"
  | "perspective_view";

const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  flowchart: "Flowchart",
  block_diagram: "Block Diagram",
  system_architecture: "System Architecture",
  ui_mockup: "UI Mockup",
  data_flow: "Data Flow",
  perspective_view: "Perspective View",
};

type ImageModelId = "nano-banana-2" | "gemini-2.5-flash-image" | "imagen-4" | "gpt-image-1";

interface PlacedNumeral {
  id: string;
  numeral: number;
  elementName: string;
  xPercent: number;
  yPercent: number;
}

interface DrawingStudioClientProps {
  patent: Patent & {
    drawings: PatentDrawing[];
    referenceNumerals: ReferenceNumeral[];
  };
}

export function DrawingStudioClient({ patent }: DrawingStudioClientProps) {
  const [drawings, setDrawings] = useState<PatentDrawing[]>(patent.drawings);
  const [numerals, setNumerals] = useState<ReferenceNumeral[]>(
    patent.referenceNumerals
  );
  const [selectedDrawing, setSelectedDrawing] = useState<PatentDrawing | null>(
    null
  );
  const [placedNumerals, setPlacedNumerals] = useState<PlacedNumeral[]>([]);
  const [isPlacingNumeral, setIsPlacingNumeral] = useState(false);
  const [pendingNumeral, setPendingNumeral] = useState<{
    numeral: number;
    elementName: string;
  } | null>(null);

  // AI generation state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [genModel, setGenModel] = useState<ImageModelId>(() => {
    const stored = patent.aiModelConfig?.imageModel;
    if (stored && ["nano-banana-2","gemini-2.5-flash-image","imagen-4","gpt-image-1"].includes(stored as string)) return stored as ImageModelId;
    return "nano-banana-2";
  });
  const [genType, setGenType] = useState<DrawingType>("block_diagram");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);

  // Drawing details editing
  const [editFigureNumber, setEditFigureNumber] = useState("");
  const [editFigureLabel, setEditFigureLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // New reference numeral form
  const [newNumeralName, setNewNumeralName] = useState("");
  const [newNumeralDesc, setNewNumeralDesc] = useState("");

  const imageContainerRef = useRef<HTMLDivElement>(null);
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
        const base64 = dataUrl.split(",")[1];
        setReferenceImageBase64(base64);
      };
      reader.readAsDataURL(file);

      if (refImageInputRef.current) refImageInputRef.current.value = "";
    },
    []
  );

  const nextNumeral = useCallback(() => {
    if (numerals.length === 0) return 100;
    const max = Math.max(...numerals.map((n) => n.numeral));
    return max + 2;
  }, [numerals]);

  const nextFigureNumber = useCallback(() => {
    if (drawings.length === 0) return "1";
    const nums = drawings
      .map((d) => parseInt(d.figureNumber, 10))
      .filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [drawings]);

  const handleSelectDrawing = useCallback((drawing: PatentDrawing) => {
    setSelectedDrawing(drawing);
    setEditFigureNumber(drawing.figureNumber);
    setEditFigureLabel(drawing.figureLabel);
    setEditDescription(drawing.description ?? "");
    setIsPlacingNumeral(false);
    setPendingNumeral(null);

    const existing = drawing.annotations?.numerals ?? [];
    setPlacedNumerals(
      existing.map((n) => ({
        id: n.id,
        numeral: n.numeral,
        elementName: n.elementName,
        xPercent: n.x,
        yPercent: n.y,
      }))
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!genDescription.trim()) {
      toast.error("Please enter a description for the drawing.");
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setGeneratedImageUrl(null);
    setGenerationError(null);

    try {
      const typeLabel = DRAWING_TYPE_LABELS[genType];
      const prompt = `${typeLabel} showing: ${genDescription}`;

      const body: Record<string, unknown> = { prompt, model: genModel };
      if (referenceImageBase64) {
        body.referenceImage = referenceImageBase64;
      }

      const res = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Image generation failed");
      }

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
  }, [genDescription, genModel, genType, referenceImageBase64]);

  const [isAccepting, setIsAccepting] = useState(false);

  const handleAcceptGenerated = useCallback(async () => {
    if (!generatedImage) return;

    setIsAccepting(true);
    const figNum = nextFigureNumber();

    try {
      const saved = await createDrawing({
        patentId: patent.id,
        figureNumber: figNum,
        figureLabel: genDescription.slice(0, 80),
        description: genDescription,
        originalUrl: generatedImageUrl || generatedImage,
        annotations: { numerals: [], arrows: [] },
        generationPrompt: genDescription,
        generationModel: genModel,
        width: 1024,
        height: 1024,
        dpi: 300,
        isCompliant: false,
      });

      setDrawings((prev) => [...prev, saved]);
      setGenerateOpen(false);
      setGeneratedImage(null);
      setGeneratedImageUrl(null);
      setGenDescription("");
      setReferenceImageBase64(null);
      setReferenceImagePreview(null);
      handleSelectDrawing(saved);
      toast.success(`FIG. ${figNum} saved to patent.`);
    } catch {
      toast.error("Failed to save drawing.");
    } finally {
      setIsAccepting(false);
    }
  }, [
    generatedImage,
    generatedImageUrl,
    genDescription,
    genModel,
    nextFigureNumber,
    patent.id,
    handleSelectDrawing,
  ]);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingNumeral || !pendingNumeral || !imageContainerRef.current)
        return;

      const rect = imageContainerRef.current.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      const placed: PlacedNumeral = {
        id: crypto.randomUUID(),
        numeral: pendingNumeral.numeral,
        elementName: pendingNumeral.elementName,
        xPercent,
        yPercent,
      };

      setPlacedNumerals((prev) => [...prev, placed]);
      setIsPlacingNumeral(false);
      setPendingNumeral(null);
      toast.success(
        `Placed numeral ${placed.numeral} (${placed.elementName})`
      );
    },
    [isPlacingNumeral, pendingNumeral]
  );

  const handleRemovePlacedNumeral = useCallback((id: string) => {
    setPlacedNumerals((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleAddReferenceNumeral = useCallback(async () => {
    if (!newNumeralName.trim()) {
      toast.error("Please enter an element name.");
      return;
    }

    try {
      const num = nextNumeral();
      const created = await createReferenceNumeral({
        patentId: patent.id,
        numeral: num,
        elementName: newNumeralName.trim(),
        description: newNumeralDesc.trim() || undefined,
        firstFigureId: selectedDrawing?.id,
      });

      setNumerals((prev) => [...prev, created]);
      setNewNumeralName("");
      setNewNumeralDesc("");
      toast.success(`Reference numeral ${num} created.`);
    } catch {
      toast.error("Failed to create reference numeral.");
    }
  }, [
    newNumeralName,
    newNumeralDesc,
    nextNumeral,
    patent.id,
    selectedDrawing,
  ]);

  const handleStartPlaceNumeral = useCallback(
    (numeral: number, elementName: string) => {
      if (!selectedDrawing) {
        toast.error("Select a drawing first.");
        return;
      }
      setPendingNumeral({ numeral, elementName });
      setIsPlacingNumeral(true);
      toast.info("Click on the drawing to place the numeral.");
    },
    [selectedDrawing]
  );

  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const handleSaveDrawingDetails = useCallback(async () => {
    if (!selectedDrawing) return;

    setIsSavingDetails(true);
    const annotations = {
      numerals: placedNumerals.map((p) => ({
        id: p.id,
        numeral: p.numeral,
        x: p.xPercent,
        y: p.yPercent,
        elementName: p.elementName,
      })),
      arrows: selectedDrawing.annotations?.arrows ?? [],
    };

    try {
      const updated = await updateDrawing(selectedDrawing.id, {
        figureNumber: editFigureNumber,
        figureLabel: editFigureLabel,
        description: editDescription,
        annotations,
      });

      setDrawings((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      setSelectedDrawing(updated);
      toast.success("Drawing details saved.");
    } catch {
      toast.error("Failed to save drawing details.");
    } finally {
      setIsSavingDetails(false);
    }
  }, [
    selectedDrawing,
    editFigureNumber,
    editFigureLabel,
    editDescription,
    placedNumerals,
  ]);

  const handleExportPng = useCallback(() => {
    if (!selectedDrawing?.originalUrl) {
      toast.error("No image to export.");
      return;
    }
    const link = document.createElement("a");
    link.href = selectedDrawing.originalUrl;
    link.download = `FIG_${selectedDrawing.figureNumber}.png`;
    link.click();
    toast.success("Image downloaded.");
  }, [selectedDrawing]);

  const [isExportingZip, setIsExportingZip] = useState(false);

  const handleExportZip = useCallback(async () => {
    const withImages = drawings.filter((d) => d.originalUrl);
    if (withImages.length === 0) {
      toast.error("No drawings to export.");
      return;
    }

    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("patent-drawings")!;

      await Promise.all(
        withImages.map(async (drawing) => {
          const url = drawing.originalUrl!;
          let blob: Blob;

          if (url.startsWith("data:")) {
            const res = await fetch(url);
            blob = await res.blob();
          } else {
            const res = await fetch(url);
            blob = await res.blob();
          }

          const ext = blob.type === "image/jpeg" ? "jpg" : "png";
          folder.file(`FIG_${drawing.figureNumber}.${ext}`, blob);
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patent.title?.replace(/[^a-zA-Z0-9]/g, "_") ?? "patent"}_drawings.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${withImages.length} drawing${withImages.length !== 1 ? "s" : ""} as ZIP.`);
    } catch {
      toast.error("Failed to create ZIP archive.");
    } finally {
      setIsExportingZip(false);
    }
  }, [drawings, patent.title]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Image className="h-5 w-5" />
            Drawing Studio
          </h2>
          <p className="text-muted-foreground text-sm">
            Create, annotate, and manage patent drawings for{" "}
            <span className="font-medium text-foreground">{patent.title}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {drawings.length} drawing{drawings.length !== 1 && "s"}
          </Badge>
          <Badge variant="outline">
            {numerals.length} numeral{numerals.length !== 1 && "s"}
          </Badge>
          {drawings.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportZip}
              disabled={isExportingZip}
            >
              <Archive className="h-4 w-4 mr-2" />
              {isExportingZip ? "Exporting..." : "Export All (ZIP)"}
            </Button>
          )}
          <Dialog open={generateOpen} onOpenChange={(open) => {
              setGenerateOpen(open);
              if (!open) {
                setReferenceImageBase64(null);
                setReferenceImagePreview(null);
              }
            }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Drawing
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  Generate Patent Drawing
                </DialogTitle>
                <DialogDescription>
                  Describe the drawing and select a generation model.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe the drawing to generate, e.g. 'A system architecture showing the client, server, and database components with data flow arrows...'"
                    value={genDescription}
                    onChange={(e) => setGenDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={genModel}
                      onValueChange={(v) => setGenModel(v as ImageModelId)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nano-banana-2">Nano Banana 2 (Google)</SelectItem>
                        <SelectItem value="gemini-2.5-flash-image">
                          Gemini 2.5 Flash Image
                        </SelectItem>
                        <SelectItem value="imagen-4">Imagen 4</SelectItem>
                        <SelectItem value="gpt-image-1">
                          GPT Image 1
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Drawing Type</Label>
                    <Select
                      value={genType}
                      onValueChange={(v) => setGenType(v as DrawingType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DRAWING_TYPE_LABELS).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
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
                    Upload an image to guide the AI in generating a similar-style drawing.
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
                    {generationError.toLowerCase().includes("api key") && (
                      <p className="text-xs text-muted-foreground">
                        Check your API keys in Settings. The selected model requires a valid key.
                      </p>
                    )}
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
                      onClick={handleAcceptGenerated}
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
                    disabled={isGenerating || !genDescription.trim()}
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
        </div>
      </div>

      {/* Drawing Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Drawing Gallery</CardTitle>
          <CardDescription>
            {drawings.length === 0
              ? "No drawings yet — generate your first drawing above."
              : `${drawings.length} figure${drawings.length !== 1 ? "s" : ""} in this patent`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drawings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Image className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm max-w-sm">
                No drawings yet. Click &quot;Add Drawing&quot; to generate a
                patent drawing with AI.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {drawings.map((drawing) => (
                <button
                  key={drawing.id}
                  onClick={() => handleSelectDrawing(drawing)}
                  className={`group relative rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                    selectedDrawing?.id === drawing.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/50"
                  }`}
                >
                  <div className="aspect-square rounded-md bg-muted mb-3 overflow-hidden flex items-center justify-center">
                    {drawing.originalUrl ? (
                      <img
                        src={drawing.originalUrl}
                        alt={drawing.figureLabel}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        FIG. {drawing.figureNumber}
                      </span>
                      {drawing.isCompliant && (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Compliant
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {drawing.figureLabel}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawing Workspace */}
      {selectedDrawing && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] min-w-0">
          {/* Main image viewer with annotation overlay */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  FIG. {selectedDrawing.figureNumber} —{" "}
                  {selectedDrawing.figureLabel}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isPlacingNumeral && (
                    <Badge variant="destructive" className="gap-1">
                      <Hash className="h-3 w-3" />
                      Click to place #{pendingNumeral?.numeral}
                      <button
                        onClick={() => {
                          setIsPlacingNumeral(false);
                          setPendingNumeral(null);
                        }}
                        className="ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPng}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export PNG
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={imageContainerRef}
                onClick={handleImageClick}
                className={`relative rounded-lg border bg-white overflow-hidden ${
                  isPlacingNumeral ? "cursor-crosshair" : "cursor-default"
                }`}
              >
                {selectedDrawing.originalUrl ? (
                  <img
                    src={selectedDrawing.originalUrl}
                    alt={selectedDrawing.figureLabel}
                    className="w-full"
                    draggable={false}
                  />
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-muted">
                    <Image className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}

                {/* Annotation overlay */}
                {placedNumerals.map((pn) => (
                  <div
                    key={pn.id}
                    className="absolute group"
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
                          handleRemovePlacedNumeral(pn.id);
                        }}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap border">
                        {pn.numeral} — {pn.elementName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar tools */}
          <div className="space-y-4">
            {/* Drawing details form */}
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
                    placeholder="e.g. System Architecture"
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
                  onClick={handleSaveDrawingDetails}
                  disabled={isSavingDetails}
                >
                  {isSavingDetails ? (
                    <Wand2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {isSavingDetails ? "Saving..." : "Save Details"}
                </Button>
              </CardContent>
            </Card>

            {/* Annotation tools */}
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
                {numerals.length > 0 && (
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {numerals.map((n) => {
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
                                    handleStartPlaceNumeral(
                                      n.numeral,
                                      n.elementName
                                    )
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
                              onClick={() => handleRemovePlacedNumeral(p.id)}
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

            {/* Reference numeral management */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Reference Numerals
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage numerals across the patent ({numerals.length} defined)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {nextNumeral()}
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
                    onClick={handleAddReferenceNumeral}
                    disabled={!newNumeralName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Numeral
                  </Button>
                </div>

                {numerals.length > 0 && (
                  <>
                    <Separator />
                    <ScrollArea className="max-h-56">
                      <div className="space-y-1.5">
                        {numerals.map((n) => (
                          <div
                            key={n.id}
                            className="rounded-md border px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm">
                                {n.numeral}
                              </span>
                              <span className="text-sm font-medium">
                                {n.elementName}
                              </span>
                            </div>
                            {n.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {n.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              {drawings
                                .filter((d) =>
                                  d.annotations?.numerals?.some(
                                    (an) => an.numeral === n.numeral
                                  ) ||
                                  placedNumerals.some(
                                    (p) =>
                                      p.numeral === n.numeral &&
                                      selectedDrawing?.id === d.id
                                  )
                                )
                                .map((d) => (
                                  <Badge
                                    key={d.id}
                                    variant="secondary"
                                    className="text-[10px] h-4"
                                  >
                                    FIG. {d.figureNumber}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

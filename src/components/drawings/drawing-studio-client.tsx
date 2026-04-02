"use client";

import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import type { Patent, PatentDrawing, ReferenceNumeral } from "@/lib/types";
import {
  createReferenceNumeral,
  createDrawing,
  updateDrawing,
  deleteDrawing,
  duplicateDrawing,
  reorderDrawings,
  deleteReferenceNumeral,
  deduplicateReferenceNumerals,
} from "@/lib/actions/patents";
import { toast } from "sonner";
import type { DrawingType } from "@/lib/ai/drawing-prompts";

import { StudioHeader } from "./studio-header";
import { GalleryPanel } from "./gallery-panel";
import { WorkspacePanel } from "./workspace-panel";
import { GenerateDialog } from "./generate-dialog";
import { UploadDialog } from "./upload-dialog";
import { RegenerateDialog } from "./regenerate-dialog";
import { EditDrawingDialog } from "./edit-drawing-dialog";
import type { ImageModelId, PlacedNumeral, VersionEntry } from "./drawing-types";

interface DrawingStudioClientProps {
  patent: Patent & {
    drawings: PatentDrawing[];
    referenceNumerals: ReferenceNumeral[];
  };
}

export function DrawingStudioClient({ patent }: DrawingStudioClientProps) {
  const [drawings, setDrawings] = useState<PatentDrawing[]>(
    [...patent.drawings].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    )
  );
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

  const [regenerateTarget, setRegenerateTarget] =
    useState<PatentDrawing | null>(null);
  const [editTarget, setEditTarget] = useState<PatentDrawing | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);

  const defaultModel: ImageModelId = (() => {
    const stored = patent.aiModelConfig?.imageModel;
    if (
      stored &&
      [
        "nano-banana-2",
        "gemini-2.5-flash-image",
        "imagen-4",
        "gpt-image-1",
      ].includes(stored as string)
    )
      return stored as ImageModelId;
    return "nano-banana-2";
  })();

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

  // ─── Selection ──────────────────────────────────────────────
  const handleSelectDrawing = useCallback((drawing: PatentDrawing) => {
    setSelectedDrawing(drawing);
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

  // ─── Generate (new drawing) ─────────────────────────────────
  const handleGenerateAccept = useCallback(
    async (data: {
      imageBase64: string;
      imageUrl: string;
      description: string;
      model: ImageModelId;
      figureType: DrawingType;
    }) => {
      const figNum = nextFigureNumber();
      const saved = await createDrawing({
        patentId: patent.id,
        figureNumber: figNum,
        figureLabel: data.description.slice(0, 80),
        figureType: data.figureType,
        description: data.description,
        originalUrl: data.imageUrl,
        annotations: { numerals: [], arrows: [] },
        generationPrompt: data.description,
        generationModel: data.model,
        sortOrder: drawings.length,
        width: 1024,
        height: 1024,
        dpi: 300,
        isCompliant: false,
      });
      setDrawings((prev) => [...prev, saved]);
      handleSelectDrawing(saved);
      toast.success(`FIG. ${figNum} saved to patent.`);
    },
    [nextFigureNumber, patent.id, drawings.length, handleSelectDrawing]
  );

  // ─── Upload ─────────────────────────────────────────────────
  const handleUploadAccept = useCallback(
    async (data: {
      imageDataUrl: string;
      label: string;
      description: string;
      figureType: DrawingType;
    }) => {
      const figNum = nextFigureNumber();
      let imageUrl = data.imageDataUrl;

      try {
        const base64 = data.imageDataUrl.split(",")[1];
        const filename = `upload-fig-${figNum}-${Date.now()}.png`;
        const uploadRes = await fetch("/api/drawings/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, filename }),
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) imageUrl = uploadData.url;
      } catch {
        // fall through with data URL
      }

      const saved = await createDrawing({
        patentId: patent.id,
        figureNumber: figNum,
        figureLabel: data.label,
        figureType: data.figureType,
        description: data.description,
        originalUrl: imageUrl,
        annotations: { numerals: [], arrows: [] },
        generationModel: "upload",
        sortOrder: drawings.length,
        width: 1024,
        height: 1024,
        dpi: 300,
        isCompliant: false,
      });
      setDrawings((prev) => [...prev, saved]);
      handleSelectDrawing(saved);
      toast.success(`FIG. ${figNum} uploaded.`);
    },
    [nextFigureNumber, patent.id, drawings.length, handleSelectDrawing]
  );

  // ─── Regenerate ─────────────────────────────────────────────
  const handleRegenerateAccept = useCallback(
    async (data: {
      drawingId: string;
      imageBase64: string;
      imageUrl: string;
      prompt: string;
      model: ImageModelId;
      figureType: DrawingType;
    }) => {
      const target = drawings.find((d) => d.id === data.drawingId);
      if (!target) return;

      const prevVersions: VersionEntry[] =
        (target.previousVersions as VersionEntry[] | null) ?? [];
      if (target.originalUrl && target.generationPrompt) {
        prevVersions.push({
          url: target.originalUrl,
          prompt: target.generationPrompt,
          model: target.generationModel ?? "unknown",
          createdAt: target.updatedAt?.toISOString?.() ?? new Date().toISOString(),
        });
      }

      const updated = await updateDrawing(data.drawingId, {
        originalUrl: data.imageUrl,
        generationPrompt: data.prompt,
        generationModel: data.model,
        figureType: data.figureType,
        previousVersions: prevVersions,
      });
      setDrawings((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      if (selectedDrawing?.id === updated.id) setSelectedDrawing(updated);
      setRegenerateTarget(null);
      toast.success("Drawing regenerated.");
    },
    [drawings, selectedDrawing]
  );

  // ─── Edit with prompt ──────────────────────────────────────
  const handleEditAccept = useCallback(
    async (data: {
      drawingId: string;
      imageBase64: string;
      imageUrl: string;
      editPrompt: string;
      model: ImageModelId;
    }) => {
      const target = drawings.find((d) => d.id === data.drawingId);
      if (!target) return;

      const prevVersions: VersionEntry[] =
        (target.previousVersions as VersionEntry[] | null) ?? [];
      if (target.originalUrl) {
        prevVersions.push({
          url: target.originalUrl,
          prompt: target.generationPrompt ?? "",
          model: target.generationModel ?? "unknown",
          createdAt: target.updatedAt?.toISOString?.() ?? new Date().toISOString(),
        });
      }

      const updated = await updateDrawing(data.drawingId, {
        originalUrl: data.imageUrl,
        generationPrompt: `[Edit] ${data.editPrompt}`,
        generationModel: data.model,
        previousVersions: prevVersions,
      });
      setDrawings((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      if (selectedDrawing?.id === updated.id) setSelectedDrawing(updated);
      setEditTarget(null);
      toast.success("Drawing edited.");
    },
    [drawings, selectedDrawing]
  );

  // ─── Reorder ────────────────────────────────────────────────
  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      const reordered = orderedIds
        .map((id) => drawings.find((d) => d.id === id))
        .filter(Boolean) as PatentDrawing[];
      setDrawings(reordered);
      try {
        await reorderDrawings(patent.id, orderedIds);
      } catch {
        toast.error("Failed to save new order.");
      }
    },
    [drawings, patent.id]
  );

  // ─── Rename ─────────────────────────────────────────────────
  const handleRename = useCallback(
    async (id: string, newLabel: string) => {
      try {
        const updated = await updateDrawing(id, { figureLabel: newLabel });
        setDrawings((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        if (selectedDrawing?.id === updated.id) setSelectedDrawing(updated);
        toast.success("Renamed.");
      } catch {
        toast.error("Failed to rename.");
      }
    },
    [selectedDrawing]
  );

  // ─── Delete ─────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (drawing: PatentDrawing) => {
      if (
        !window.confirm(
          `Delete FIG. ${drawing.figureNumber} — ${drawing.figureLabel}?`
        )
      )
        return;
      try {
        await deleteDrawing(drawing.id, patent.id);
        setDrawings((prev) => prev.filter((d) => d.id !== drawing.id));
        if (selectedDrawing?.id === drawing.id) {
          setSelectedDrawing(null);
          setPlacedNumerals([]);
        }
        toast.success("Drawing deleted.");
      } catch {
        toast.error("Failed to delete drawing.");
      }
    },
    [patent.id, selectedDrawing]
  );

  // ─── Duplicate ──────────────────────────────────────────────
  const handleDuplicate = useCallback(
    async (drawing: PatentDrawing) => {
      try {
        const dup = await duplicateDrawing(drawing.id);
        setDrawings((prev) => [...prev, dup]);
        toast.success(`FIG. ${dup.figureNumber} created as copy.`);
      } catch {
        toast.error("Failed to duplicate drawing.");
      }
    },
    []
  );

  // ─── Download ───────────────────────────────────────────────
  const handleDownload = useCallback((drawing: PatentDrawing) => {
    if (!drawing.originalUrl) {
      toast.error("No image to export.");
      return;
    }
    const link = document.createElement("a");
    link.href = drawing.originalUrl;
    link.download = `FIG_${drawing.figureNumber}.png`;
    link.click();
    toast.success("Image downloaded.");
  }, []);

  // ─── Process for USPTO ─────────────────────────────────────
  const handleProcess = useCallback(
    async (drawing: PatentDrawing) => {
      if (!drawing.originalUrl) {
        toast.error("No image to process.");
        return;
      }
      setIsProcessing(true);
      try {
        let imageBase64: string;
        if (drawing.originalUrl.startsWith("data:")) {
          imageBase64 = drawing.originalUrl.split(",")[1];
        } else {
          const res = await fetch(drawing.originalUrl);
          const blob = await res.blob();
          const buffer = await blob.arrayBuffer();
          imageBase64 = btoa(
            new Uint8Array(buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );
        }

        const processRes = await fetch("/api/drawings/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        const processData = await processRes.json();
        if (!processRes.ok) throw new Error(processData.error || "Processing failed");

        let processedUrl = `data:image/png;base64,${processData.processed}`;
        try {
          const uploadRes = await fetch("/api/drawings/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: processData.processed,
              filename: `processed-fig-${drawing.figureNumber}-${Date.now()}.png`,
            }),
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.url) processedUrl = uploadData.url;
        } catch {
          // fall through with data URL
        }

        const updated = await updateDrawing(drawing.id, {
          processedUrl,
          isCompliant: true,
          width: processData.width,
          height: processData.height,
          dpi: processData.dpi,
        });
        setDrawings((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        if (selectedDrawing?.id === updated.id) setSelectedDrawing(updated);
        toast.success("Drawing processed for USPTO compliance.");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Processing failed: ${msg}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedDrawing]
  );

  // ─── Export ZIP ─────────────────────────────────────────────
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
        withImages.map(async (d) => {
          const res = await fetch(d.originalUrl!);
          const blob = await res.blob();
          const ext = blob.type === "image/jpeg" ? "jpg" : "png";
          folder.file(`FIG_${d.figureNumber}.${ext}`, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patent.title?.replace(/[^a-zA-Z0-9]/g, "_") ?? "patent"}_drawings.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${withImages.length} drawing${withImages.length !== 1 ? "s" : ""} as ZIP.`
      );
    } catch {
      toast.error("Failed to create ZIP archive.");
    } finally {
      setIsExportingZip(false);
    }
  }, [drawings, patent.title]);

  // ─── Annotation placement ──────────────────────────────────
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingNumeral || !pendingNumeral) return;
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
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

  const handlePlaceNumeral = useCallback(
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

  const handleRemovePlacedNumeral = useCallback((id: string) => {
    setPlacedNumerals((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // ─── Save details in workspace ─────────────────────────────
  const handleSaveDetails = useCallback(
    async (data: {
      figureNumber: string;
      figureLabel: string;
      description: string;
      annotations: {
        numerals: { id: string; numeral: number; x: number; y: number; elementName: string }[];
        arrows: { id: string; fromX: number; fromY: number; toX: number; toY: number }[];
      };
    }) => {
      if (!selectedDrawing) return;
      const updated = await updateDrawing(selectedDrawing.id, data);
      setDrawings((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      setSelectedDrawing(updated);
    },
    [selectedDrawing]
  );

  // ─── Add reference numeral ─────────────────────────────────
  const handleAddNumeral = useCallback(
    async (name: string, description: string) => {
      const num = nextNumeral();
      const created = await createReferenceNumeral({
        patentId: patent.id,
        numeral: num,
        elementName: name,
        description: description || undefined,
        firstFigureId: selectedDrawing?.id,
      });
      setNumerals((prev) => [...prev, created]);
      toast.success(`Reference numeral ${num} created.`);
    },
    [nextNumeral, patent.id, selectedDrawing]
  );

  const handleDeleteNumeral = useCallback(
    async (id: string) => {
      try {
        await deleteReferenceNumeral(id, patent.id);
        setNumerals((prev) => prev.filter((n) => n.id !== id));
        toast.success("Numeral deleted.");
      } catch {
        toast.error("Failed to delete numeral.");
      }
    },
    [patent.id]
  );

  const handleDeduplicateNumerals = useCallback(async () => {
    try {
      const removed = await deduplicateReferenceNumerals(patent.id);
      const seen = new Map<number, ReferenceNumeral>();
      for (const n of numerals) {
        if (!seen.has(n.numeral)) {
          seen.set(n.numeral, n);
        }
      }
      setNumerals(Array.from(seen.values()));
      toast.success(`Removed ${removed} duplicate numeral${removed !== 1 ? "s" : ""}.`);
    } catch {
      toast.error("Failed to deduplicate numerals.");
    }
  }, [patent.id, numerals]);

  return (
    <div className="p-6 space-y-6">
      <StudioHeader
        patentTitle={patent.title}
        drawingCount={drawings.length}
        numeralCount={numerals.length}
        isExportingZip={isExportingZip}
        onExportZip={handleExportZip}
      >
        <UploadDialog onAccept={handleUploadAccept} />
        <GenerateDialog
          defaultModel={defaultModel}
          onAccept={handleGenerateAccept}
        />
      </StudioHeader>

      <GalleryPanel
        drawings={drawings}
        selectedDrawing={selectedDrawing}
        onSelect={handleSelectDrawing}
        onReorder={handleReorder}
        onRename={handleRename}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onRegenerate={(d) => setRegenerateTarget(d)}
        onEdit={(d) => setEditTarget(d)}
        onDownload={handleDownload}
        onProcess={handleProcess}
      />

      {selectedDrawing && (
        <WorkspacePanel
          drawing={selectedDrawing}
          numerals={numerals}
          placedNumerals={placedNumerals}
          onSaveDetails={handleSaveDetails}
          onPlaceNumeral={handlePlaceNumeral}
          onRemovePlacedNumeral={handleRemovePlacedNumeral}
          onImageClick={handleImageClick}
          isPlacingNumeral={isPlacingNumeral}
          pendingNumeral={pendingNumeral}
          onCancelPlacing={() => {
            setIsPlacingNumeral(false);
            setPendingNumeral(null);
          }}
          onRegenerate={() => setRegenerateTarget(selectedDrawing)}
          onEditDrawing={() => setEditTarget(selectedDrawing)}
          onExportPng={() => handleDownload(selectedDrawing)}
          onProcess={() => handleProcess(selectedDrawing)}
          onAddNumeral={handleAddNumeral}
          onDeleteNumeral={handleDeleteNumeral}
          onDeduplicateNumerals={handleDeduplicateNumerals}
          nextNumeral={nextNumeral()}
        />
      )}

      {regenerateTarget && (
        <RegenerateDialog
          drawing={regenerateTarget}
          open={!!regenerateTarget}
          onOpenChange={(open) => {
            if (!open) setRegenerateTarget(null);
          }}
          onAccept={handleRegenerateAccept}
        />
      )}

      {editTarget && (
        <EditDrawingDialog
          drawing={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onAccept={handleEditAccept}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Image } from "lucide-react";
import type { PatentDrawing } from "@/lib/types";
import { ThumbnailCard } from "./thumbnail-card";

interface GalleryPanelProps {
  drawings: PatentDrawing[];
  selectedDrawing: PatentDrawing | null;
  onSelect: (drawing: PatentDrawing) => void;
  onReorder: (orderedIds: string[]) => void;
  onRename: (id: string, newLabel: string) => void;
  onDelete: (drawing: PatentDrawing) => void;
  onDuplicate: (drawing: PatentDrawing) => void;
  onRegenerate: (drawing: PatentDrawing) => void;
  onEdit: (drawing: PatentDrawing) => void;
  onDownload: (drawing: PatentDrawing) => void;
  onProcess: (drawing: PatentDrawing) => void;
}

export function GalleryPanel({
  drawings,
  selectedDrawing,
  onSelect,
  onReorder,
  onRename,
  onDelete,
  onDuplicate,
  onRegenerate,
  onEdit,
  onDownload,
  onProcess,
}: GalleryPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = drawings.findIndex((d) => d.id === active.id);
      const newIndex = drawings.findIndex((d) => d.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...drawings];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onReorder(reordered.map((d) => d.id));
    },
    [drawings, onReorder]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drawing Gallery</CardTitle>
        <CardDescription>
          {drawings.length === 0
            ? "No drawings yet — generate or upload your first drawing."
            : `${drawings.length} figure${drawings.length !== 1 ? "s" : ""} in this patent. Drag to reorder. Double-click labels to rename.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {drawings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Image className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm max-w-sm">
              No drawings yet. Click &quot;Add Drawing&quot; to generate a
              patent drawing with AI, or &quot;Upload Drawing&quot; to add an
              existing one.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={drawings.map((d) => d.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {drawings.map((drawing) => (
                  <ThumbnailCard
                    key={drawing.id}
                    drawing={drawing}
                    isSelected={selectedDrawing?.id === drawing.id}
                    onSelect={onSelect}
                    onRename={onRename}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onRegenerate={onRegenerate}
                    onEdit={onEdit}
                    onDownload={onDownload}
                    onProcess={onProcess}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

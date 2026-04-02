"use client";

import { useState, useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Copy,
  Download,
  GripVertical,
  Image,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  Shield,
} from "lucide-react";
import type { PatentDrawing } from "@/lib/types";

interface ThumbnailCardProps {
  drawing: PatentDrawing;
  isSelected: boolean;
  onSelect: (drawing: PatentDrawing) => void;
  onRename: (id: string, newLabel: string) => void;
  onDelete: (drawing: PatentDrawing) => void;
  onDuplicate: (drawing: PatentDrawing) => void;
  onRegenerate: (drawing: PatentDrawing) => void;
  onEdit: (drawing: PatentDrawing) => void;
  onDownload: (drawing: PatentDrawing) => void;
  onProcess: (drawing: PatentDrawing) => void;
}

export function ThumbnailCard({
  drawing,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
  onRegenerate,
  onEdit,
  onDownload,
  onProcess,
}: ThumbnailCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(drawing.figureLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: drawing.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== drawing.figureLabel) {
      onRename(drawing.id, trimmed);
    } else {
      setEditValue(drawing.figureLabel);
    }
    setIsEditing(false);
  }, [editValue, drawing, onRename]);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(drawing.figureLabel);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border p-3 text-left transition-all hover:shadow-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      } ${
        isSelected
          ? "ring-2 ring-primary border-primary"
          : "hover:border-primary/50"
      }`}
    >
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing bg-background/80 rounded p-0.5 hover:bg-muted"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-background/80">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onRegenerate(drawing)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(drawing)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit with Prompt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={startRename}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(drawing)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDownload(drawing)}>
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onProcess(drawing)}>
              <Shield className="h-4 w-4 mr-2" />
              Process for USPTO
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(drawing)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        onClick={() => onSelect(drawing)}
        className="w-full text-left"
      >
        <div className="aspect-square rounded-md bg-muted mb-3 overflow-hidden flex items-center justify-center">
          {drawing.originalUrl ? (
            <img
              src={drawing.originalUrl}
              alt={drawing.figureLabel}
              className="w-full h-full object-contain"
              draggable={false}
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
              <Badge variant="secondary" className="text-xs gap-1">
                <Check className="h-3 w-3" />
                Compliant
              </Badge>
            )}
          </div>
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setEditValue(drawing.figureLabel);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-xs px-1"
              autoFocus
            />
          ) : (
            <p
              className="text-xs text-muted-foreground line-clamp-2"
              onDoubleClick={startRename}
            >
              {drawing.figureLabel}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

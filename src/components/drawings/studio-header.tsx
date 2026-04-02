"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, Image } from "lucide-react";

interface StudioHeaderProps {
  patentTitle: string;
  drawingCount: number;
  numeralCount: number;
  isExportingZip: boolean;
  onExportZip: () => void;
  children: React.ReactNode;
}

export function StudioHeader({
  patentTitle,
  drawingCount,
  numeralCount,
  isExportingZip,
  onExportZip,
  children,
}: StudioHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Image className="h-5 w-5" />
          Drawing Studio
        </h2>
        <p className="text-muted-foreground text-sm">
          Create, annotate, and manage patent drawings for{" "}
          <span className="font-medium text-foreground">{patentTitle}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">
          {drawingCount} drawing{drawingCount !== 1 && "s"}
        </Badge>
        <Badge variant="outline">
          {numeralCount} numeral{numeralCount !== 1 && "s"}
        </Badge>
        {drawingCount > 0 && (
          <Button
            variant="outline"
            onClick={onExportZip}
            disabled={isExportingZip}
          >
            <Archive className="h-4 w-4 mr-2" />
            {isExportingZip ? "Exporting..." : "Export All (ZIP)"}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

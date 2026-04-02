"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import type { VersionEntry } from "./drawing-types";

interface VersionHistoryProps {
  versions: VersionEntry[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (versions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Version History
        </CardTitle>
        <CardDescription className="text-xs">
          {versions.length} previous version{versions.length !== 1 && "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-64">
          <div className="space-y-3">
            {versions
              .slice()
              .reverse()
              .map((v, i) => (
                <div
                  key={`${v.createdAt}-${i}`}
                  className="rounded-lg border p-2 space-y-2"
                >
                  <div className="aspect-square rounded-md bg-white overflow-hidden">
                    <img
                      src={v.url}
                      alt={`Version ${versions.length - i}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        v{versions.length - i}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {v.model}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {v.prompt}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

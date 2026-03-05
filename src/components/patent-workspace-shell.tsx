"use client";

import { useAppStore } from "@/lib/store";
import { PriorArtSidebar } from "@/components/prior-art/prior-art-sidebar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function PatentWorkspaceShell({
  children,
  patentId,
}: {
  children: React.ReactNode;
  patentId: string;
}) {
  const sidebarOpen = useAppStore((s) => s.priorArtSidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setPriorArtSidebarOpen);

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 flex flex-col overflow-auto">
        {children}
      </div>

      {sidebarOpen && (
        <div className="w-[360px] shrink-0 border-l flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h3 className="text-sm font-medium">Prior Art Search</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <PriorArtSidebar patentId={patentId} />
          </div>
        </div>
      )}
    </div>
  );
}

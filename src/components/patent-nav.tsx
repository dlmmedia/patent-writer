"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileEdit,
  Scale,
  Image,
  Search,
  Download,
  Settings2,
} from "lucide-react";

const TABS = [
  { label: "Overview", href: "", icon: LayoutDashboard },
  { label: "Editor", href: "/editor", icon: FileEdit },
  { label: "Claims", href: "/claims", icon: Scale },
  { label: "Drawings", href: "/drawings", icon: Image },
  { label: "Prior Art", href: "/prior-art", icon: Search },
  { label: "Export", href: "/export", icon: Download },
  { label: "Config", href: "/config", icon: Settings2 },
] as const;

export function PatentNav({ patentId }: { patentId: string }) {
  const pathname = usePathname();
  const basePath = `/patents/${patentId}`;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `${basePath}${tab.href}`;
        const isActive = tab.href === ""
          ? pathname === basePath
          : pathname.startsWith(href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

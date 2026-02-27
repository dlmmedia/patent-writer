"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
}

export function PatentNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 -mb-px overflow-x-auto">
      {tabs.map((tab) => {
        const isActive =
          tab.href === pathname ||
          (tab.href !== tabs[0].href && pathname.startsWith(tab.href));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap",
              isActive
                ? "border-[oklch(0.72_0.12_85)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

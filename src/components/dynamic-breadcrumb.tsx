"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  patents: "Patents",
  new: "New Patent",
  editor: "Editor",
  claims: "Claims",
  drawings: "Drawings",
  "prior-art": "Prior Art",
  export: "Export",
  config: "Configuration",
  search: "Search",
  templates: "Templates",
  settings: "Settings",
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { label: string; href: string; isLast: boolean }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(segment);
    if (isUuid) continue;

    const label = ROUTE_LABELS[segment] || segment;
    crumbs.push({ label, href: currentPath, isLast });
  }

  if (crumbs.length === 0) {
    crumbs.push({ label: "Dashboard", href: "/dashboard", isLast: true });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.href}>
            {idx > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage className="font-medium">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

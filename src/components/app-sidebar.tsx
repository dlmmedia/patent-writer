"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  Search,
  LayoutTemplate,
  Settings,
  Plus,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Patents", href: "/patents", icon: FileText },
  { title: "Search", href: "/search", icon: Search },
  { title: "Templates", href: "/templates", icon: LayoutTemplate },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
            style={{ background: "linear-gradient(135deg, oklch(0.27 0.05 260), oklch(0.33 0.06 260))" }}
          >
            <Scale className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="heading-serif text-base font-semibold tracking-tight">
              PatentWriter
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-2 pt-3">
            <Link href="/patents/new">
              <Button
                className="w-full justify-start gap-2 btn-press text-white hover:opacity-90 shadow-sm"
                style={{ background: "linear-gradient(135deg, oklch(0.27 0.05 260), oklch(0.33 0.06 260))" }}
                size="sm"
              >
                <Plus className="h-4 w-4" />
                New Patent
              </Button>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`transition-all duration-200 ${
                        isActive
                          ? "border-l-[3px] border-l-[oklch(0.72_0.12_85)] rounded-l-none font-medium"
                          : "hover:translate-x-0.5"
                      }`}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <p className="text-[10px]">Patent Writer</p>
          </div>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
            v0.1
          </Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

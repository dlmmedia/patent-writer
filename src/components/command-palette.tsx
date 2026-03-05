"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FileText,
  Search,
  LayoutTemplate,
  Settings,
  Plus,
  Scale,
  Cpu,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/lib/store";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const setPriorArtSidebarOpen = useAppStore((s) => s.setPriorArtSidebarOpen);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const patentMatch = pathname.match(/\/patents\/([^/]+)/);
  const currentPatentId = patentMatch ? patentMatch[1] : null;
  const isUuid = currentPatentId && /^[0-9a-f]{8}-/.test(currentPatentId);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate("/patents")}>
            <FileText className="mr-2 h-4 w-4" />
            Patents
          </CommandItem>
          <CommandItem onSelect={() => navigate("/search")}>
            <Search className="mr-2 h-4 w-4" />
            Patent Search
          </CommandItem>
          <CommandItem onSelect={() => navigate("/templates")}>
            <LayoutTemplate className="mr-2 h-4 w-4" />
            Templates
          </CommandItem>
          <CommandItem onSelect={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => navigate("/patents/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Patent
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              if (isUuid) {
                setPriorArtSidebarOpen(true);
              } else {
                router.push("/search");
              }
            }}
          >
            <Scale className="mr-2 h-4 w-4" />
            Prior Art Search
          </CommandItem>
          <CommandItem onSelect={() => navigate("/settings")}>
            <Cpu className="mr-2 h-4 w-4" />
            AI Model Configuration
          </CommandItem>
        </CommandGroup>

        {isUuid && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Current Patent">
              <CommandItem onSelect={() => navigate(`/patents/${currentPatentId}/editor`)}>
                <FileText className="mr-2 h-4 w-4" />
                Open Editor
              </CommandItem>
              <CommandItem onSelect={() => navigate(`/patents/${currentPatentId}/claims`)}>
                <Scale className="mr-2 h-4 w-4" />
                Open Claims
              </CommandItem>
              <CommandItem onSelect={() => navigate(`/patents/${currentPatentId}/prior-art`)}>
                <Search className="mr-2 h-4 w-4" />
                Open Prior Art
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            Toggle Theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

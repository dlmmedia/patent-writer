"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  PenLine,
  Scale,
  Cpu,
  Download,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tools">
          <CommandItem onSelect={() => navigate("/search")}>
            <Scale className="mr-2 h-4 w-4" />
            Prior Art Search
          </CommandItem>
          <CommandItem onSelect={() => navigate("/settings")}>
            <Cpu className="mr-2 h-4 w-4" />
            AI Model Configuration
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

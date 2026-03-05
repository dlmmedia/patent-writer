"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Trash2,
  Globe,
  Layers,
  Cpu,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createTemplate, deleteTemplate } from "@/lib/actions/patents";

type Template = {
  id: string;
  name: string;
  jurisdiction: "US" | "EP" | "JP" | "CN" | "PCT" | "KR" | "AU" | "CA" | "GB" | null;
  patentType: "utility" | "design" | "provisional" | "pct" | null;
  technologyArea: string | null;
  sectionTemplates: { sectionType: string; title: string; placeholder: string }[] | null;
  claimTemplates: { claimType: string; template: string }[] | null;
  isDefault: boolean | null;
  createdAt: Date;
};

const TYPE_LABELS: Record<string, string> = {
  utility: "Utility",
  design: "Design",
  provisional: "Provisional",
  pct: "PCT",
};

const JURISDICTION_LABELS: Record<string, string> = {
  US: "United States (USPTO)",
  EP: "Europe (EPO)",
  JP: "Japan (JPO)",
  CN: "China (CNIPA)",
  PCT: "International (WIPO/PCT)",
  KR: "South Korea (KIPO)",
  AU: "Australia (IP Australia)",
  CA: "Canada (CIPO)",
  GB: "United Kingdom (UKIPO)",
};

export function TemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>("US");
  const [patentType, setPatentType] = useState<string>("utility");
  const [technologyArea, setTechnologyArea] = useState("");

  function handleUseTemplate(template: Template) {
    router.push(`/patents/new?template=${template.id}`);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteTemplate(id);
        toast.success("Template deleted");
      } catch {
        toast.error("Failed to delete template");
      }
    });
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    startTransition(async () => {
      try {
        await createTemplate({
          name: name.trim(),
          jurisdiction: jurisdiction as Template["jurisdiction"] & string,
          patentType: patentType as Template["patentType"] & string,
          technologyArea: technologyArea.trim() || undefined,
        });
        toast.success("Template created");
        setDialogOpen(false);
        setName("");
        setJurisdiction("US");
        setPatentType("utility");
        setTechnologyArea("");
      } catch {
        toast.error("Failed to create template");
      }
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="heading-serif text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates
          </h2>
          <p className="text-muted-foreground">
            Pre-configured patent templates for quick project setup
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-press legal-gradient text-white hover:opacity-90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
              <DialogDescription>
                Create a reusable template for new patent projects.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. US Utility Patent - Biotech"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jurisdiction">Jurisdiction</Label>
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger id="jurisdiction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(JURISDICTION_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="patentType">Patent Type</Label>
                <Select value={patentType} onValueChange={setPatentType}>
                  <SelectTrigger id="patentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="technologyArea">Technology Area (optional)</Label>
                <Input
                  id="technologyArea"
                  placeholder="e.g. Machine Learning, Mechanical Engineering"
                  value={technologyArea}
                  onChange={(e) => setTechnologyArea(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col card-hover">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">
                  {template.name}
                </CardTitle>
                {template.isDefault && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0 shrink-0 bg-[oklch(0.72_0.12_85/0.15)] text-[oklch(0.45_0.1_85)] border-[oklch(0.72_0.12_85/0.3)]"
                  >
                    Default
                  </Badge>
                )}
              </div>
              <CardDescription className="flex flex-wrap gap-2 pt-1">
                {template.jurisdiction && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    {template.jurisdiction}
                  </Badge>
                )}
                {template.patentType && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Layers className="h-3 w-3" />
                    {TYPE_LABELS[template.patentType] ?? template.patentType}
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              {template.technologyArea && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5" />
                  {template.technologyArea}
                </div>
              )}

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 btn-press"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(template.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="heading-serif text-lg font-medium mb-1">No Templates</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Create reusable templates to quickly start new patent projects with
              pre-configured settings.
            </p>
            <Button className="btn-press" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

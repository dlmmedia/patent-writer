"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Layers,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";

interface TemplateItem {
  id: string;
  name: string;
  jurisdiction: string;
  jurisdictionLabel: string;
  patentType: string;
  technologyArea: string;
  isDefault: boolean;
}

const DEFAULT_TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-1",
    name: "US Utility Patent - Software",
    jurisdiction: "US",
    jurisdictionLabel: "United States (USPTO)",
    patentType: "utility",
    technologyArea: "Software/Technology",
    isDefault: true,
  },
  {
    id: "tpl-2",
    name: "US Utility Patent - Mechanical",
    jurisdiction: "US",
    jurisdictionLabel: "United States (USPTO)",
    patentType: "utility",
    technologyArea: "Mechanical Engineering",
    isDefault: true,
  },
  {
    id: "tpl-3",
    name: "US Provisional Application",
    jurisdiction: "US",
    jurisdictionLabel: "United States (USPTO)",
    patentType: "provisional",
    technologyArea: "General",
    isDefault: true,
  },
  {
    id: "tpl-4",
    name: "PCT International Application",
    jurisdiction: "PCT",
    jurisdictionLabel: "International (WIPO/PCT)",
    patentType: "pct",
    technologyArea: "General",
    isDefault: true,
  },
  {
    id: "tpl-5",
    name: "European Patent Application",
    jurisdiction: "EP",
    jurisdictionLabel: "Europe (EPO)",
    patentType: "utility",
    technologyArea: "General",
    isDefault: true,
  },
];

const TYPE_LABELS: Record<string, string> = {
  utility: "Utility",
  design: "Design",
  provisional: "Provisional",
  pct: "PCT",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>(DEFAULT_TEMPLATES);

  function handleUseTemplate(template: TemplateItem) {
    toast.success(`Creating new patent from "${template.name}"...`);
  }

  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted");
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
        <Button className="btn-press legal-gradient text-white hover:opacity-90 shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
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
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 bg-[oklch(0.72_0.12_85/0.15)] text-[oklch(0.45_0.1_85)] border-[oklch(0.72_0.12_85/0.3)]">
                    Recommended
                  </Badge>
                )}
              </div>
              <CardDescription className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Globe className="h-3 w-3" />
                  {template.jurisdiction}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Layers className="h-3 w-3" />
                  {TYPE_LABELS[template.patentType] ?? template.patentType}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                {template.technologyArea}
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 btn-press"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(template.id)}
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
            <Button className="btn-press">
              <Plus className="h-4 w-4 mr-2" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

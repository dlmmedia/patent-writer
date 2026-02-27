"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { updatePatent } from "@/lib/actions/patents";
import {
  modelInfo,
  imageModelInfo,
  type ModelId,
  type ImageModelId,
} from "@/lib/ai/providers";
import type { Patent } from "@/lib/types";
import { JURISDICTION_LABELS } from "@/lib/types";
import type { Jurisdiction, PatentType, PatentStatus, EntitySize } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Save,
  Settings,
  User,
  Calendar,
  Hash,
  Brain,
  Cpu,
  Plus,
  X,
} from "lucide-react";

const configSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["utility", "design", "provisional", "pct"]),
  jurisdiction: z.enum(["US", "EP", "JP", "CN", "PCT", "KR", "AU", "CA", "GB"]),
  entitySize: z.enum(["micro", "small", "large"]),
  technologyArea: z.string().optional(),
  cpcCodes: z.array(z.string()),
  inventors: z.array(
    z.object({ name: z.string().min(1, "Name required"), address: z.string().optional() })
  ),
  assignee: z.string().optional(),
  priorityDate: z.string().optional(),
  filingDate: z.string().optional(),
  status: z.enum(["draft", "in_progress", "review", "ready_to_file", "filed", "abandoned"]),
  draftingModel: z.string(),
  claimsModel: z.string(),
  analysisModel: z.string(),
  imageModel: z.string(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

const MODEL_IDS = Object.keys(modelInfo) as ModelId[];
const IMAGE_MODEL_IDS = Object.keys(imageModelInfo) as ImageModelId[];

const PRESETS: Record<string, { drafting: ModelId; claims: ModelId; analysis: ModelId; image: ImageModelId }> = {
  economy: {
    drafting: "gemini-2.5-flash",
    claims: "gpt-5-mini",
    analysis: "gemini-2.5-flash",
    image: "imagen-3",
  },
  balanced: {
    drafting: "gpt-5-mini",
    claims: "o3",
    analysis: "gemini-2.5-pro",
    image: "imagen-3",
  },
  premium: {
    drafting: "gpt-5.2",
    claims: "gpt-5.2-pro",
    analysis: "gpt-5.2",
    image: "gpt-image-1",
  },
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

export function ConfigClient({ patent }: { patent: Patent }) {
  const [isPending, startTransition] = useTransition();
  const [newCpcCode, setNewCpcCode] = useState("");

  const aiConfig = (patent.aiModelConfig as {
    draftingModel: string;
    claimsModel: string;
    analysisModel: string;
    imageModel: string;
  }) ?? {
    draftingModel: "gemini-2.5-flash",
    claimsModel: "gpt-5.2",
    analysisModel: "gemini-2.5-pro",
    imageModel: "imagen-3",
  };

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      title: patent.title,
      type: patent.type as PatentType,
      jurisdiction: patent.jurisdiction as Jurisdiction,
      entitySize: (patent.entitySize ?? "small") as EntitySize,
      technologyArea: patent.technologyArea ?? "",
      cpcCodes: (patent.cpcCodes as string[]) ?? [],
      inventors: (patent.inventors as { name: string; address?: string }[]) ?? [],
      assignee: patent.assignee ?? "",
      priorityDate: formatDate(patent.priorityDate),
      filingDate: formatDate(patent.filingDate),
      status: patent.status as PatentStatus,
      draftingModel: aiConfig.draftingModel,
      claimsModel: aiConfig.claimsModel,
      analysisModel: aiConfig.analysisModel,
      imageModel: aiConfig.imageModel,
    },
  });

  const { fields: inventorFields, append: addInventor, remove: removeInventor } =
    useFieldArray({ control: form.control, name: "inventors" });

  const cpcCodes = form.watch("cpcCodes");

  function addCpcCode() {
    const code = newCpcCode.trim().toUpperCase();
    if (code && !cpcCodes.includes(code)) {
      form.setValue("cpcCodes", [...cpcCodes, code]);
      setNewCpcCode("");
    }
  }

  function removeCpcCode(code: string) {
    form.setValue("cpcCodes", cpcCodes.filter((c) => c !== code));
  }

  function applyPreset(preset: keyof typeof PRESETS) {
    const p = PRESETS[preset];
    form.setValue("draftingModel", p.drafting);
    form.setValue("claimsModel", p.claims);
    form.setValue("analysisModel", p.analysis);
    form.setValue("imageModel", p.image);
    toast.success(`Applied ${preset} preset`);
  }

  function onSubmit(values: ConfigFormValues) {
    startTransition(async () => {
      try {
        await updatePatent(patent.id, {
          title: values.title,
          type: values.type,
          jurisdiction: values.jurisdiction,
          entitySize: values.entitySize,
          technologyArea: values.technologyArea || null,
          cpcCodes: values.cpcCodes,
          inventors: values.inventors,
          assignee: values.assignee || null,
          priorityDate: values.priorityDate ? new Date(values.priorityDate) : null,
          filingDate: values.filingDate ? new Date(values.filingDate) : null,
          status: values.status,
          aiModelConfig: {
            draftingModel: values.draftingModel,
            claimsModel: values.claimsModel,
            analysisModel: values.analysisModel,
            imageModel: values.imageModel,
          },
        });
        toast.success("Patent configuration saved");
      } catch {
        toast.error("Failed to save configuration");
      }
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </h2>
          <p className="text-muted-foreground">
            Manage patent settings, AI models, and metadata
          </p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
          <Save className="h-4 w-4 mr-2" />
          {isPending ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* AI Model Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4" />
                AI Model Configuration
              </CardTitle>
              <CardDescription>
                Choose models for each task. Higher-tier models produce better
                results but cost more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("economy")}
                >
                  Economy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("balanced")}
                >
                  Balanced
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("premium")}
                >
                  Premium
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="draftingModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drafting Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODEL_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              <div className="flex flex-col">
                                <span>{modelInfo[id].name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {modelInfo[id].provider} &middot;{" "}
                                  {modelInfo[id].bestFor}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Used for drafting patent sections
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="claimsModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Claims Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODEL_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              <div className="flex flex-col">
                                <span>{modelInfo[id].name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {modelInfo[id].provider} &middot;{" "}
                                  {modelInfo[id].bestFor}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Used for claim generation and analysis
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="analysisModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Analysis Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODEL_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              <div className="flex flex-col">
                                <span>{modelInfo[id].name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {modelInfo[id].provider} &middot;{" "}
                                  {modelInfo[id].bestFor}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Used for prior art analysis and novelty checks
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {IMAGE_MODEL_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              <div className="flex flex-col">
                                <span>{imageModelInfo[id].name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {imageModelInfo[id].provider} &middot;{" "}
                                  {imageModelInfo[id].bestFor}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Used for patent drawing generation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Patent Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" />
                Patent Details
              </CardTitle>
              <CardDescription>
                Core patent metadata and classification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Title of the Invention" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patent Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="utility">Utility</SelectItem>
                          <SelectItem value="design">Design</SelectItem>
                          <SelectItem value="provisional">Provisional</SelectItem>
                          <SelectItem value="pct">PCT</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jurisdiction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jurisdiction</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(
                            Object.entries(JURISDICTION_LABELS) as [
                              Jurisdiction,
                              string,
                            ][]
                          ).map(([code, label]) => (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entitySize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Size</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="micro">Micro Entity</SelectItem>
                          <SelectItem value="small">Small Entity</SelectItem>
                          <SelectItem value="large">Large Entity</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="technologyArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technology Area</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Machine Learning, Biotech, Semiconductor"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label className="mb-2 block">
                  <Hash className="h-3 w-3 inline mr-1" />
                  CPC Codes
                </Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {cpcCodes.map((code) => (
                    <Badge key={code} variant="secondary" className="gap-1">
                      {code}
                      <button
                        type="button"
                        onClick={() => removeCpcCode(code)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCpcCode}
                    onChange={(e) => setNewCpcCode(e.target.value)}
                    placeholder="e.g., G06F 3/01"
                    className="max-w-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCpcCode();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCpcCode}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventors & Assignee */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Inventors &amp; Assignee
              </CardTitle>
              <CardDescription>
                Inventor details and assignee information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Inventors</Label>
                {inventorFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`inventors.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} placeholder="Full name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`inventors.${index}.address`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="Address (optional)"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInventor(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addInventor({ name: "", address: "" })}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Inventor
                </Button>
              </div>

              <Separator />

              <FormField
                control={form.control}
                name="assignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Company or individual name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Filing Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Filing Details
              </CardTitle>
              <CardDescription>
                Dates and filing status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="priorityDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="filingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filing Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="ready_to_file">Ready to File</SelectItem>
                          <SelectItem value="filed">Filed</SelectItem>
                          <SelectItem value="abandoned">Abandoned</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

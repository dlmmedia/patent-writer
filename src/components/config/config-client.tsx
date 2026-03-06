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
import type { CorrespondenceAddress, GovernmentContract, RelatedApplication, Inventor, KeyFeature } from "@/lib/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  Building,
  FileText,
  Link2,
  Lightbulb,
  MessageSquare,
} from "lucide-react";

const configSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["utility", "design", "provisional", "pct"]),
  jurisdiction: z.enum(["US", "EP", "JP", "CN", "PCT", "KR", "AU", "CA", "GB"]),
  entitySize: z.enum(["micro", "small", "large"]),
  technologyArea: z.string().optional(),
  cpcCodes: z.array(z.string()),
  inventors: z.array(
    z.object({
      givenName: z.string().optional(),
      familyName: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      email: z.string().optional(),
      name: z.string().optional(),
      address: z.string().optional(),
    })
  ),
  assignee: z.string().optional(),
  docketNumber: z.string().optional(),
  applicationNumber: z.string().optional(),
  publicationNumber: z.string().optional(),
  kindCode: z.string().optional(),
  correspondenceAddress: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    customerNumber: z.string().optional(),
  }).optional(),
  governmentContract: z.object({
    isMadeByAgency: z.boolean().optional(),
    isUnderContract: z.boolean().optional(),
    agencyName: z.string().optional(),
    contractNumber: z.string().optional(),
  }).optional(),
  relatedApplications: z.array(z.object({
    type: z.enum(["provisional", "continuation", "divisional", "cip"]),
    applicationNumber: z.string().optional(),
    filingDate: z.string().optional(),
    title: z.string().optional(),
  })),
  inventionProblem: z.string().optional(),
  inventionSolution: z.string().optional(),
  inventionDescription: z.string().optional(),
  keyFeatures: z.array(z.object({
    feature: z.string(),
    description: z.string().optional(),
    isNovel: z.boolean().optional(),
  })),
  knownPriorArt: z.string().optional(),
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
  economy: { drafting: "gemini-2.5-flash", claims: "gemini-2.5-flash", analysis: "gemini-2.5-flash", image: "nano-banana-2" },
  balanced: { drafting: "gemini-3.1-pro", claims: "gemini-3.1-pro", analysis: "gemini-3.1-pro", image: "nano-banana-2" },
  premium: { drafting: "gpt-4o", claims: "gemini-3.1-pro", analysis: "gemini-3.1-pro", image: "imagen-4" },
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
    draftingModel: string; claimsModel: string; analysisModel: string; imageModel: string;
  }) ?? { draftingModel: "gemini-3.1-pro", claimsModel: "gemini-3.1-pro", analysisModel: "gemini-3.1-pro", imageModel: "nano-banana-2" };

  const inventors = (patent.inventors as Inventor[] | null) ?? [];
  const correspondence = (patent.correspondenceAddress as CorrespondenceAddress | null) ?? {};
  const govContract = (patent.governmentContract as GovernmentContract | null) ?? {};
  const relatedApps = (patent.relatedApplications as RelatedApplication[] | null) ?? [];
  const keyFeatures = (patent.keyFeatures as KeyFeature[] | null) ?? [];

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      title: patent.title,
      type: patent.type as PatentType,
      jurisdiction: patent.jurisdiction as Jurisdiction,
      entitySize: (patent.entitySize ?? "small") as EntitySize,
      technologyArea: patent.technologyArea ?? "",
      cpcCodes: (patent.cpcCodes as string[]) ?? [],
      inventors: inventors.map((i) => ({
        givenName: i.givenName || "",
        familyName: i.familyName || "",
        city: i.city || "",
        state: i.state || "",
        country: i.country || "",
        email: i.email || "",
        name: i.name || "",
        address: i.address || "",
      })),
      assignee: patent.assignee ?? "",
      docketNumber: patent.docketNumber ?? "",
      applicationNumber: patent.applicationNumber ?? "",
      publicationNumber: patent.publicationNumber ?? "",
      kindCode: patent.kindCode ?? "",
      correspondenceAddress: correspondence,
      governmentContract: govContract,
      relatedApplications: relatedApps,
      inventionProblem: patent.inventionProblem ?? "",
      inventionSolution: patent.inventionSolution ?? "",
      inventionDescription: patent.inventionDescription ?? "",
      keyFeatures,
      knownPriorArt: patent.knownPriorArt ?? "",
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

  const { fields: featureFields, append: addFeature, remove: removeFeature } =
    useFieldArray({ control: form.control, name: "keyFeatures" });

  const { fields: relatedFields, append: addRelatedApp, remove: removeRelatedApp } =
    useFieldArray({ control: form.control, name: "relatedApplications" });

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
          inventors: values.inventors.map((i) => ({
            givenName: i.givenName || "",
            familyName: i.familyName || "",
            city: i.city,
            state: i.state,
            country: i.country,
            email: i.email,
            name: i.name || `${i.givenName || ""} ${i.familyName || ""}`.trim(),
            address: i.address,
          })),
          assignee: values.assignee || null,
          docketNumber: values.docketNumber || null,
          applicationNumber: values.applicationNumber || null,
          publicationNumber: values.publicationNumber || null,
          kindCode: values.kindCode || null,
          correspondenceAddress: values.correspondenceAddress || null,
          governmentContract: values.governmentContract || null,
          relatedApplications: values.relatedApplications,
          inventionProblem: values.inventionProblem || null,
          inventionSolution: values.inventionSolution || null,
          inventionDescription: values.inventionDescription || null,
          keyFeatures: values.keyFeatures,
          knownPriorArt: values.knownPriorArt || null,
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
            Manage patent settings, bibliographic data, AI models, and invention disclosure
          </p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
          <Save className="h-4 w-4 mr-2" />
          {isPending ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── AI Models ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4" /> AI Model Configuration
              </CardTitle>
              <CardDescription>Choose models for each task.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                {(["economy", "balanced", "premium"] as const).map((p) => (
                  <Button key={p} type="button" variant="outline" size="sm" onClick={() => applyPreset(p)} className="capitalize">
                    {p}
                  </Button>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(["draftingModel", "claimsModel", "analysisModel"] as const).map((field) => (
                  <FormField
                    key={field}
                    control={form.control}
                    name={field}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{field.replace("Model", " Model")}</FormLabel>
                        <Select onValueChange={f.onChange} defaultValue={f.value}>
                          <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {MODEL_IDS.map((id) => (
                              <SelectItem key={id} value={id}>
                                {modelInfo[id].name} ({modelInfo[id].provider})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name="imageModel"
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Image Model</FormLabel>
                      <Select onValueChange={f.onChange} defaultValue={f.value}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {IMAGE_MODEL_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              {imageModelInfo[id].name} ({imageModelInfo[id].provider})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Patent Details ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" /> Patent Details
              </CardTitle>
              <CardDescription>Core metadata and INID bibliographic fields</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>(54) Title</FormLabel>
                  <FormControl><Input {...field} placeholder="Title of the Invention" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patent Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="utility">Utility</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="provisional">Provisional</SelectItem>
                        <SelectItem value="pct">PCT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="jurisdiction" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jurisdiction</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.entries(JURISDICTION_LABELS) as [Jurisdiction, string][]).map(([code, label]) => (
                          <SelectItem key={code} value={code}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="entitySize" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity Size</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="micro">Micro Entity</SelectItem>
                        <SelectItem value="small">Small Entity</SelectItem>
                        <SelectItem value="large">Large Entity</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="docketNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Docket Number</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., ABC-001-US" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="applicationNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>(21) Application Number</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., 18/123,456" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="publicationNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>(11) Publication Number</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., US 2024/0123456" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="kindCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>(10) Kind Code</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., A1, B2" /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="technologyArea" render={({ field }) => (
                <FormItem>
                  <FormLabel>Technology Area</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g., Machine Learning, Biotech" /></FormControl>
                </FormItem>
              )} />

              <div>
                <Label className="mb-2 block"><Hash className="h-3 w-3 inline mr-1" />(51) CPC Codes</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {cpcCodes.map((code) => (
                    <Badge key={code} variant="secondary" className="gap-1">
                      {code}
                      <button type="button" onClick={() => removeCpcCode(code)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newCpcCode} onChange={(e) => setNewCpcCode(e.target.value)} placeholder="e.g., G06F 3/01" className="max-w-xs"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCpcCode(); } }} />
                  <Button type="button" variant="outline" size="sm" onClick={addCpcCode}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Inventors & Assignee ───────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Inventors & Assignee
              </CardTitle>
              <CardDescription>(72)/(75) Inventor details and (73) Assignee</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {inventorFields.map((field, index) => (
                  <div key={field.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Inventor {index + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeInventor(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input placeholder="Given Name" {...form.register(`inventors.${index}.givenName`)} />
                      <Input placeholder="Family Name" {...form.register(`inventors.${index}.familyName`)} />
                      <Input placeholder="City" {...form.register(`inventors.${index}.city`)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="State" {...form.register(`inventors.${index}.state`)} />
                        <Input placeholder="Country" {...form.register(`inventors.${index}.country`)} />
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addInventor({ givenName: "", familyName: "", city: "", state: "", country: "US" })}>
                  <Plus className="h-3 w-3 mr-1" /> Add Inventor
                </Button>
              </div>
              <Separator />
              <FormField control={form.control} name="assignee" render={({ field }) => (
                <FormItem>
                  <FormLabel>(73) Assignee</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="Company or individual" /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Correspondence Address ─────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-4 w-4" /> Correspondence Address
              </CardTitle>
              <CardDescription>For PTO/SB/16 cover sheet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Firm or Individual Name" {...form.register("correspondenceAddress.name")} />
                <Input placeholder="Address" {...form.register("correspondenceAddress.address")} />
                <Input placeholder="City" {...form.register("correspondenceAddress.city")} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="State" {...form.register("correspondenceAddress.state")} />
                  <Input placeholder="ZIP" {...form.register("correspondenceAddress.zip")} />
                </div>
                <Input placeholder="Country" {...form.register("correspondenceAddress.country")} />
                <Input placeholder="Phone" {...form.register("correspondenceAddress.phone")} />
                <Input placeholder="Email" {...form.register("correspondenceAddress.email")} className="sm:col-span-2" />
              </div>
            </CardContent>
          </Card>

          {/* ── Invention Disclosure ───────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4" /> Invention Disclosure
              </CardTitle>
              <CardDescription>Structured problem/solution and key features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="inventionProblem" render={({ field }) => (
                <FormItem>
                  <FormLabel>Problem Being Solved</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} placeholder="Technical problem..." /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="inventionSolution" render={({ field }) => (
                <FormItem>
                  <FormLabel>Solution / How It Works</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} placeholder="Technical approach..." /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="inventionDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Description</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={4} placeholder="Comprehensive description..." /></FormControl>
                </FormItem>
              )} />

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Key Features</Label>
                {featureFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1 grid gap-2 sm:grid-cols-2">
                      <Input placeholder="Feature" {...form.register(`keyFeatures.${index}.feature`)} />
                      <Input placeholder="Description" {...form.register(`keyFeatures.${index}.description`)} />
                    </div>
                    <label className="flex items-center gap-1 text-xs pt-2">
                      <Checkbox
                        checked={form.watch(`keyFeatures.${index}.isNovel`) || false}
                        onCheckedChange={(v) => form.setValue(`keyFeatures.${index}.isNovel`, v === true)}
                      />
                      Novel
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFeature(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addFeature({ feature: "", description: "", isNovel: false })}>
                  <Plus className="h-3 w-3 mr-1" /> Add Feature
                </Button>
              </div>

              <FormField control={form.control} name="knownPriorArt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Known Prior Art</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} placeholder="Existing solutions you know of..." /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Related Applications ───────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" /> Related Applications
              </CardTitle>
              <CardDescription>(60)/(62)/(63) Priority and related filings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedFields.map((field, index) => (
                <div key={field.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Select
                      value={form.watch(`relatedApplications.${index}.type`)}
                      onValueChange={(v) => form.setValue(`relatedApplications.${index}.type`, v as any)}
                    >
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="provisional">Provisional</SelectItem>
                        <SelectItem value="continuation">Continuation</SelectItem>
                        <SelectItem value="divisional">Divisional</SelectItem>
                        <SelectItem value="cip">Continuation-in-Part</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRelatedApp(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input placeholder="Application Number" {...form.register(`relatedApplications.${index}.applicationNumber`)} />
                    <Input type="date" {...form.register(`relatedApplications.${index}.filingDate`)} />
                    <Input placeholder="Title" {...form.register(`relatedApplications.${index}.title`)} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addRelatedApp({ type: "provisional", applicationNumber: "", filingDate: "", title: "" })}>
                <Plus className="h-3 w-3 mr-1" /> Add Related Application
              </Button>
            </CardContent>
          </Card>

          {/* ── Government Contract ────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-4 w-4" /> Government Contract
              </CardTitle>
              <CardDescription>35 U.S.C. 202(c)(6) disclosure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.watch("governmentContract.isMadeByAgency") || false}
                  onCheckedChange={(v) => form.setValue("governmentContract.isMadeByAgency", v === true)}
                />
                <span className="text-sm">Made by a U.S. Government agency</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.watch("governmentContract.isUnderContract") || false}
                  onCheckedChange={(v) => form.setValue("governmentContract.isUnderContract", v === true)}
                />
                <span className="text-sm">Made under a U.S. Government contract</span>
              </label>
              {(form.watch("governmentContract.isMadeByAgency") || form.watch("governmentContract.isUnderContract")) && (
                <div className="grid gap-2 sm:grid-cols-2 pt-2">
                  <Input placeholder="Agency Name" {...form.register("governmentContract.agencyName")} />
                  {form.watch("governmentContract.isUnderContract") && (
                    <Input placeholder="Contract Number" {...form.register("governmentContract.contractNumber")} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Filing Details ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" /> Filing Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField control={form.control} name="priorityDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>(45) Priority Date</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="filingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>(22) Filing Date</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="ready_to_file">Ready to File</SelectItem>
                        <SelectItem value="filed">Filed</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
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

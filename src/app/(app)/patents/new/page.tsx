"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileText,
  Lightbulb,
  Globe,
  Cpu,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Upload,
  Sparkles,
  Zap,
  Crown,
  Scale,
  Info,
  X,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { createPatent } from "@/lib/actions/patents";
import type { PatentType, Jurisdiction } from "@/lib/types";
import { JURISDICTION_LABELS } from "@/lib/types";
import { modelInfo, imageModelInfo, type ModelId, type ImageModelId } from "@/lib/ai/providers";

const STEPS = [
  { label: "Patent Type", icon: FileText },
  { label: "Invention", icon: Lightbulb },
  { label: "CPC & Jurisdiction", icon: Globe },
  { label: "AI Models", icon: Cpu },
  { label: "Review", icon: CheckCircle2 },
] as const;

const PATENT_TYPES: { value: PatentType; label: string; description: string }[] = [
  { value: "utility", label: "Utility Patent", description: "Protects new and useful processes, machines, articles of manufacture, or compositions of matter" },
  { value: "design", label: "Design Patent", description: "Protects new, original, and ornamental designs for articles of manufacture" },
  { value: "provisional", label: "Provisional Application", description: "Establishes an early filing date without requiring formal claims or declarations" },
  { value: "pct", label: "PCT International", description: "Seek patent protection simultaneously in multiple countries via a single application" },
];

const ENTITY_SIZES: { value: "micro" | "small" | "large"; label: string; description: string }[] = [
  { value: "micro", label: "Micro Entity", description: "Individual inventors, small universities" },
  { value: "small", label: "Small Entity", description: "Companies with fewer than 500 employees" },
  { value: "large", label: "Large Entity", description: "Corporations, large organizations" },
];

const MODEL_PRESETS = {
  economy: {
    label: "Economy",
    icon: Zap,
    description: "Cost-effective, ideal for drafts and iteration",
    config: {
      draftingModel: "gemini-2.5-flash" as ModelId,
      claimsModel: "gemini-2.5-flash" as ModelId,
      analysisModel: "gemini-2.5-flash" as ModelId,
      imageModel: "nano-banana-2" as ImageModelId,
    },
  },
  balanced: {
    label: "Balanced",
    icon: Scale,
    description: "Best quality-to-cost ratio for most applications",
    config: {
      draftingModel: "gemini-3.1-pro" as ModelId,
      claimsModel: "gemini-3.1-pro" as ModelId,
      analysisModel: "gemini-3.1-pro" as ModelId,
      imageModel: "nano-banana-2" as ImageModelId,
    },
  },
  premium: {
    label: "Premium",
    icon: Crown,
    description: "Highest quality for mission-critical filings",
    config: {
      draftingModel: "gpt-4o" as ModelId,
      claimsModel: "gemini-3.1-pro" as ModelId,
      analysisModel: "gemini-3.1-pro" as ModelId,
      imageModel: "imagen-4" as ImageModelId,
    },
  },
} as const;

const SUGGESTED_CPC_CODES: { code: string; label: string }[] = [
  { code: "G06F", label: "Electric digital data processing" },
  { code: "H04L", label: "Transmission of digital information" },
  { code: "G06N", label: "Computing arrangements based on specific computational models" },
  { code: "G06Q", label: "Data processing systems for administrative or financial purposes" },
  { code: "H04W", label: "Wireless communication networks" },
];

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  type: z.enum(["utility", "design", "provisional", "pct"] as const),
  jurisdiction: z.enum(["US", "EP", "JP", "CN", "PCT", "KR", "AU", "CA", "GB"] as const),
  inventionDescription: z.string().optional(),
  technologyArea: z.string().optional(),
  entitySize: z.enum(["micro", "small", "large"] as const).optional(),
  cpcCodes: z.array(z.string()).optional(),
  draftingModel: z.string(),
  claimsModel: z.string(),
  analysisModel: z.string(),
  imageModel: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewPatentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof MODEL_PRESETS | null>("balanced");
  const [selectedCpcCodes, setSelectedCpcCodes] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<{code: string; description: string; confidence: number}[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "utility",
      jurisdiction: "US",
      inventionDescription: "",
      technologyArea: "",
      entitySize: "small",
      cpcCodes: [],
      draftingModel: MODEL_PRESETS.balanced.config.draftingModel,
      claimsModel: MODEL_PRESETS.balanced.config.claimsModel,
      analysisModel: MODEL_PRESETS.balanced.config.analysisModel,
      imageModel: MODEL_PRESETS.balanced.config.imageModel,
    },
  });

  const { watch, setValue, trigger } = form;
  const values = watch();

  const progressPercent = ((step + 1) / STEPS.length) * 100;

  function applyPreset(preset: keyof typeof MODEL_PRESETS) {
    setSelectedPreset(preset);
    const config = MODEL_PRESETS[preset].config;
    setValue("draftingModel", config.draftingModel);
    setValue("claimsModel", config.claimsModel);
    setValue("analysisModel", config.analysisModel);
    setValue("imageModel", config.imageModel);
  }

  async function goNext() {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (step === 0) fieldsToValidate = ["type", "jurisdiction"];
    if (step === 1) fieldsToValidate = ["title"];

    if (fieldsToValidate.length > 0) {
      const valid = await trigger(fieldsToValidate);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function toggleCpcCode(code: string) {
    setSelectedCpcCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function fetchCpcSuggestions() {
    const description = values.inventionDescription;
    if (!description || description.trim().length < 10) return;

    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventionDescription: description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setAiSuggestions(data.suggestions);
        }
      }
    } catch {
      // AI suggestions unavailable — fallback CPC codes remain visible
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function handleCreate() {
    startTransition(async () => {
      const patent = await createPatent({
        title: values.title,
        type: values.type,
        jurisdiction: values.jurisdiction,
        inventionDescription: values.inventionDescription || undefined,
        technologyArea: values.technologyArea || undefined,
        entitySize: values.entitySize || undefined,
        cpcCodes: selectedCpcCodes.length > 0 ? selectedCpcCodes : undefined,
        aiModelConfig: {
          draftingModel: values.draftingModel,
          claimsModel: values.claimsModel,
          analysisModel: values.analysisModel,
          imageModel: values.imageModel,
        },
      });

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("patentId", patent.id);
            await fetch("/api/patents/documents", {
              method: "POST",
              body: formData,
            });
          } catch {
            // Non-critical: documents can be re-uploaded from the editor
          }
        }
      }

      router.push(`/patents/${patent.id}`);
    });
  }

  const displayedCpcCodes = aiSuggestions.length > 0
    ? aiSuggestions.map((s) => ({ code: s.code, label: s.description }))
    : SUGGESTED_CPC_CODES;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Patent</h1>
        <p className="text-muted-foreground mt-1">
          Follow the wizard to set up your patent application project.
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isComplete = i < step;
            return (
              <button
                key={s.label}
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "text-primary font-medium"
                    : isComplete
                      ? "text-primary/70 cursor-pointer hover:text-primary"
                      : "text-muted-foreground"
                }`}
                disabled={i > step}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Step 1: Patent Type */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5" />
              Patent Type & Jurisdiction
            </CardTitle>
            <CardDescription>
              Select the type of patent application and primary filing jurisdiction.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Application Type</Label>
              <RadioGroup
                value={values.type}
                onValueChange={(v) => setValue("type", v as PatentType)}
                className="grid gap-3 sm:grid-cols-2"
              >
                {PATENT_TYPES.map((pt) => (
                  <label
                    key={pt.value}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                      values.type === pt.value ? "border-primary bg-accent/30" : ""
                    }`}
                  >
                    <RadioGroupItem value={pt.value} className="mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{pt.label}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {pt.description}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction" className="text-sm font-medium">
                Primary Jurisdiction
              </Label>
              <Select
                value={values.jurisdiction}
                onValueChange={(v) => setValue("jurisdiction", v as Jurisdiction)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(JURISDICTION_LABELS) as [Jurisdiction, string][]).map(
                    ([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entitySize" className="text-sm font-medium">
                Entity Size
              </Label>
              <RadioGroup
                value={values.entitySize || "small"}
                onValueChange={(v) => setValue("entitySize", v as "micro" | "small" | "large")}
                className="grid gap-3 sm:grid-cols-3"
              >
                {ENTITY_SIZES.map((es) => (
                  <label
                    key={es.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                      values.entitySize === es.value ? "border-primary bg-accent/30" : ""
                    }`}
                  >
                    <RadioGroupItem value={es.value} className="mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">{es.label}</div>
                      <div className="text-xs text-muted-foreground">{es.description}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Invention Input */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="h-5 w-5" />
              Describe Your Invention
            </CardTitle>
            <CardDescription>
              Provide a working title and describe your invention in plain language.
              The AI will use this to generate the patent application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Working Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., System and Method for Real-Time Translation Using Neural Networks"
                value={values.title}
                onChange={(e) => setValue("title", e.target.value)}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="technologyArea" className="text-sm font-medium">
                Technology Area
              </Label>
              <Input
                id="technologyArea"
                placeholder="e.g., Natural Language Processing, Machine Learning"
                value={values.technologyArea || ""}
                onChange={(e) => setValue("technologyArea", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventionDescription" className="text-sm font-medium">
                Invention Description
              </Label>
              <Textarea
                id="inventionDescription"
                placeholder="Describe your invention in plain language. Include the problem it solves, how it works, and what makes it novel..."
                value={values.inventionDescription || ""}
                onChange={(e) => setValue("inventionDescription", e.target.value)}
                rows={8}
                className="resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Be as detailed as possible. The AI uses this to draft your specification and claims.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Supporting Documents</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  PDF, DOCX, images, or technical diagrams
                </p>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>Choose Files</span>
                  </Button>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.svg"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {uploadedFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeFile(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: CPC & Jurisdiction */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Globe className="h-5 w-5" />
              CPC Classification & Jurisdiction
            </CardTitle>
            <CardDescription>
              Review AI-suggested CPC codes and adjust jurisdiction settings for your application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Suggested CPC Codes</Label>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  {aiSuggestions.length > 0 ? "AI Suggested" : "Default"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Select the CPC classification codes most relevant to your invention. These help
                categorize your patent for prior art searches.
              </p>

              {values.inventionDescription && values.inventionDescription.trim().length >= 10 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={fetchCpcSuggestions}
                  disabled={loadingSuggestions}
                >
                  {loadingSuggestions ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Get AI Suggestions
                    </>
                  )}
                </Button>
              )}

              <div className="grid gap-2">
                {displayedCpcCodes.map((cpc) => (
                  <label
                    key={cpc.code}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                      selectedCpcCodes.includes(cpc.code) ? "border-primary bg-accent/30" : ""
                    }`}
                    onClick={() => toggleCpcCode(cpc.code)}
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                        selectedCpcCodes.includes(cpc.code)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {selectedCpcCodes.includes(cpc.code) && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {cpc.code}
                        </Badge>
                        <span className="text-sm">{cpc.label}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Jurisdiction Details</Label>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Primary Filing</span>
                  <Badge>{JURISDICTION_LABELS[values.jurisdiction]}</Badge>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-accent/50 rounded-md p-3">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {values.type === "pct"
                      ? "PCT applications are filed through WIPO and can enter national phase in multiple jurisdictions. Additional national phase entries can be configured after project creation."
                      : `Your application will be prepared according to ${JURISDICTION_LABELS[values.jurisdiction]} formatting requirements and legal standards.`}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Model Selection */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cpu className="h-5 w-5" />
              AI Model Configuration
            </CardTitle>
            <CardDescription>
              Choose AI models for each stage of patent drafting. Start with a preset or customize individually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Presets</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.entries(MODEL_PRESETS) as [keyof typeof MODEL_PRESETS, typeof MODEL_PRESETS[keyof typeof MODEL_PRESETS]][]).map(
                  ([key, preset]) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent/50 ${
                          selectedPreset === key ? "border-primary bg-accent/30" : ""
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${
                          key === "economy" ? "text-green-500" : key === "balanced" ? "text-blue-500" : "text-amber-500"
                        }`} />
                        <div className="font-medium text-sm">{preset.label}</div>
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          {preset.description}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Model Assignment</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Drafting Model</Label>
                  <Select
                    value={values.draftingModel}
                    onValueChange={(v) => {
                      setValue("draftingModel", v);
                      setSelectedPreset(null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(modelInfo) as [ModelId, typeof modelInfo[ModelId]][]).map(
                        ([id, info]) => (
                          <SelectItem key={id} value={id}>
                            <span>{info.name}</span>
                            <span className="text-muted-foreground ml-1">({info.provider})</span>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {modelInfo[values.draftingModel as ModelId]?.bestFor}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Claims Model</Label>
                  <Select
                    value={values.claimsModel}
                    onValueChange={(v) => {
                      setValue("claimsModel", v);
                      setSelectedPreset(null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(modelInfo) as [ModelId, typeof modelInfo[ModelId]][]).map(
                        ([id, info]) => (
                          <SelectItem key={id} value={id}>
                            <span>{info.name}</span>
                            <span className="text-muted-foreground ml-1">({info.provider})</span>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {modelInfo[values.claimsModel as ModelId]?.bestFor}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Analysis Model</Label>
                  <Select
                    value={values.analysisModel}
                    onValueChange={(v) => {
                      setValue("analysisModel", v);
                      setSelectedPreset(null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(modelInfo) as [ModelId, typeof modelInfo[ModelId]][]).map(
                        ([id, info]) => (
                          <SelectItem key={id} value={id}>
                            <span>{info.name}</span>
                            <span className="text-muted-foreground ml-1">({info.provider})</span>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {modelInfo[values.analysisModel as ModelId]?.bestFor}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Image Generation Model</Label>
                  <Select
                    value={values.imageModel}
                    onValueChange={(v) => {
                      setValue("imageModel", v);
                      setSelectedPreset(null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(imageModelInfo) as [ImageModelId, typeof imageModelInfo[ImageModelId]][]).map(
                        ([id, info]) => (
                          <SelectItem key={id} value={id}>
                            <span>{info.name}</span>
                            <span className="text-muted-foreground ml-1">({info.provider})</span>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {imageModelInfo[values.imageModel as ImageModelId]?.bestFor}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Create */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5" />
              Review & Create
            </CardTitle>
            <CardDescription>
              Review your settings below, then create the project to start drafting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReviewSection title="Patent Type">
                <Badge className="capitalize">{values.type}</Badge>
              </ReviewSection>
              <ReviewSection title="Jurisdiction">
                <Badge variant="outline">{JURISDICTION_LABELS[values.jurisdiction]}</Badge>
              </ReviewSection>
              <ReviewSection title="Entity Size">
                <span className="text-sm capitalize">{values.entitySize} entity</span>
              </ReviewSection>
              <ReviewSection title="Technology Area">
                <span className="text-sm">{values.technologyArea || "Not specified"}</span>
              </ReviewSection>
            </div>

            <div className="border-t pt-4 space-y-2">
              <h3 className="text-sm font-medium">Working Title</h3>
              <p className="text-sm">{values.title || "Not provided"}</p>
            </div>

            {values.inventionDescription && (
              <div className="border-t pt-4 space-y-2">
                <h3 className="text-sm font-medium">Invention Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                  {values.inventionDescription}
                </p>
              </div>
            )}

            {selectedCpcCodes.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <h3 className="text-sm font-medium">CPC Codes</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCpcCodes.map((code) => (
                    <Badge key={code} variant="secondary" className="font-mono">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <h3 className="text-sm font-medium">
                  Uploaded Files ({uploadedFiles.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((f, i) => (
                    <Badge key={`${f.name}-${i}`} variant="outline">
                      {f.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-medium">AI Models</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <ModelReviewItem
                  role="Drafting"
                  modelId={values.draftingModel as ModelId}
                />
                <ModelReviewItem
                  role="Claims"
                  modelId={values.claimsModel as ModelId}
                />
                <ModelReviewItem
                  role="Analysis"
                  modelId={values.analysisModel as ModelId}
                />
                <ImageModelReviewItem
                  role="Image Generation"
                  modelId={values.imageModel as ImageModelId}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={step === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} className="gap-1.5">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={isPending || !values.title}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create Patent Project
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ModelReviewItem({ role, modelId }: { role: string; modelId: ModelId }) {
  const info = modelInfo[modelId];
  if (!info) return null;
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm text-muted-foreground">{role}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{info.name}</span>
        <Badge
          variant="outline"
          className={`text-xs ${
            info.tier === "economy"
              ? "text-green-600 border-green-200"
              : info.tier === "balanced"
                ? "text-blue-600 border-blue-200"
                : "text-amber-600 border-amber-200"
          }`}
        >
          {info.tier}
        </Badge>
      </div>
    </div>
  );
}

function ImageModelReviewItem({ role, modelId }: { role: string; modelId: ImageModelId }) {
  const info = imageModelInfo[modelId];
  if (!info) return null;
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm text-muted-foreground">{role}</span>
      <span className="text-sm font-medium">{info.name}</span>
    </div>
  );
}

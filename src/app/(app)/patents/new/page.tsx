"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
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
  User,
  Building,
  MessageSquare,
  Link2,
  Plus,
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
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import { InterviewChat } from "@/components/intake/interview-chat";
import { createPatent } from "@/lib/actions/patents";
import type { PatentType, Jurisdiction } from "@/lib/types";
import { JURISDICTION_LABELS } from "@/lib/types";
import { modelInfo, imageModelInfo, type ModelId, type ImageModelId } from "@/lib/ai/providers";

const STEPS = [
  { label: "Basics", icon: FileText },
  { label: "Inventors", icon: User },
  { label: "Disclosure", icon: Lightbulb },
  { label: "AI Interview", icon: MessageSquare },
  { label: "Related & Funding", icon: Link2 },
  { label: "CPC Codes", icon: Globe },
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

const inventorSchema = z.object({
  givenName: z.string().min(1, "Given name required"),
  familyName: z.string().min(1, "Family name required"),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  email: z.string().optional(),
});

const keyFeatureSchema = z.object({
  feature: z.string().min(1, "Feature name required"),
  description: z.string().optional(),
  isNovel: z.boolean().optional(),
});

const relatedAppSchema = z.object({
  type: z.enum(["provisional", "continuation", "divisional", "cip"]),
  applicationNumber: z.string().optional(),
  filingDate: z.string().optional(),
  title: z.string().optional(),
});

const formSchema = z.object({
  // Step 1: Basics
  title: z.string().min(5, "Title must be at least 5 characters"),
  type: z.enum(["utility", "design", "provisional", "pct"] as const),
  jurisdiction: z.enum(["US", "EP", "JP", "CN", "PCT", "KR", "AU", "CA", "GB"] as const),
  entitySize: z.enum(["micro", "small", "large"] as const).optional(),
  docketNumber: z.string().optional(),
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
  // Step 2: Inventors
  inventors: z.array(inventorSchema),
  assignee: z.string().optional(),
  // Step 3: Disclosure
  inventionDescription: z.string().optional(),
  technologyArea: z.string().optional(),
  inventionProblem: z.string().optional(),
  inventionSolution: z.string().optional(),
  keyFeatures: z.array(keyFeatureSchema),
  knownPriorArt: z.string().optional(),
  // Step 5: Related Apps & Government
  relatedApplications: z.array(relatedAppSchema),
  governmentContract: z.object({
    isMadeByAgency: z.boolean().optional(),
    isUnderContract: z.boolean().optional(),
    agencyName: z.string().optional(),
    contractNumber: z.string().optional(),
  }).optional(),
  // Step 6: CPC
  cpcCodes: z.array(z.string()).optional(),
  // Step 7: AI Models
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
  const [intakeResponses, setIntakeResponses] = useState<{ question: string; answer: string; round: number }[]>([]);
  const [interviewSkipped, setInterviewSkipped] = useState(false);
  const [useCustomerNumber, setUseCustomerNumber] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "utility",
      jurisdiction: "US",
      inventionDescription: "",
      technologyArea: "",
      entitySize: "small",
      docketNumber: "",
      correspondenceAddress: {},
      inventors: [{ givenName: "", familyName: "", city: "", state: "", country: "US", email: "" }],
      assignee: "",
      inventionProblem: "",
      inventionSolution: "",
      keyFeatures: [],
      knownPriorArt: "",
      relatedApplications: [],
      governmentContract: { isMadeByAgency: false, isUnderContract: false, agencyName: "", contractNumber: "" },
      cpcCodes: [],
      draftingModel: MODEL_PRESETS.balanced.config.draftingModel,
      claimsModel: MODEL_PRESETS.balanced.config.claimsModel,
      analysisModel: MODEL_PRESETS.balanced.config.analysisModel,
      imageModel: MODEL_PRESETS.balanced.config.imageModel,
    },
  });

  const { watch, setValue, trigger } = form;
  const values = watch();

  const { fields: inventorFields, append: addInventor, remove: removeInventor } =
    useFieldArray({ control: form.control, name: "inventors" });

  const { fields: featureFields, append: addFeature, remove: removeFeature } =
    useFieldArray({ control: form.control, name: "keyFeatures" });

  const { fields: relatedFields, append: addRelatedApp, remove: removeRelatedApp } =
    useFieldArray({ control: form.control, name: "relatedApplications" });

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
    if (step === 1) fieldsToValidate = ["inventors"];
    if (step === 2) fieldsToValidate = ["title"];

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
    const description = values.inventionDescription || "";
    const problem = values.inventionProblem || "";
    const solution = values.inventionSolution || "";
    const combined = [description, problem, solution].filter(Boolean).join(". ");
    if (combined.trim().length < 10) return;

    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventionDescription: combined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setAiSuggestions(data.suggestions);
        }
      }
    } catch {
      // fallback codes remain
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
        inventors: values.inventors.filter((i) => i.givenName || i.familyName).map((i) => ({
          ...i,
          name: `${i.givenName} ${i.familyName}`.trim(),
        })),
        assignee: values.assignee || undefined,
        docketNumber: values.docketNumber || undefined,
        correspondenceAddress: values.correspondenceAddress || undefined,
        governmentContract: values.governmentContract || undefined,
        relatedApplications: values.relatedApplications.length > 0 ? values.relatedApplications : undefined,
        inventionProblem: values.inventionProblem || undefined,
        inventionSolution: values.inventionSolution || undefined,
        keyFeatures: values.keyFeatures.length > 0 ? values.keyFeatures : undefined,
        knownPriorArt: values.knownPriorArt || undefined,
        intakeCompleted: intakeResponses.length > 0 || interviewSkipped,
        intakeResponses: intakeResponses.length > 0 ? intakeResponses : undefined,
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
            // documents can be re-uploaded later
          }
        }
      }

      router.push(`/patents/${patent.id}`);
    });
  }

  const displayedCpcCodes = aiSuggestions.length > 0
    ? aiSuggestions.map((s) => ({ code: s.code, label: s.description }))
    : SUGGESTED_CPC_CODES;

  const disclosureContext = {
    title: values.title,
    inventionDescription: values.inventionDescription || "",
    inventionProblem: values.inventionProblem || "",
    inventionSolution: values.inventionSolution || "",
    technologyArea: values.technologyArea || "",
    keyFeatures: values.keyFeatures || [],
    knownPriorArt: values.knownPriorArt || "",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Patent</h1>
        <p className="text-muted-foreground mt-1">
          Complete the intake form to set up your patent application project.
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

      {/* ── Step 1: Basics ─────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5" />
              Application Basics
            </CardTitle>
            <CardDescription>
              Select the type of patent application, jurisdiction, and filing details.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Primary Jurisdiction</Label>
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
                <Label className="text-sm font-medium">Docket Number</Label>
                <Input
                  placeholder="e.g., ABC-001-US"
                  value={values.docketNumber || ""}
                  onChange={(e) => setValue("docketNumber", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Entity Size</Label>
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

            <Separator />

            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                Correspondence Address
              </Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch checked={useCustomerNumber} onCheckedChange={setUseCustomerNumber} />
                <span className="text-sm text-muted-foreground">Use Customer Number</span>
              </div>
              {useCustomerNumber ? (
                <Input
                  placeholder="USPTO Customer Number"
                  value={values.correspondenceAddress?.customerNumber || ""}
                  onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, customerNumber: e.target.value })}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Firm or Individual Name"
                    value={values.correspondenceAddress?.name || ""}
                    onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, name: e.target.value })}
                  />
                  <Input
                    placeholder="Address"
                    value={values.correspondenceAddress?.address || ""}
                    onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, address: e.target.value })}
                  />
                  <Input
                    placeholder="City"
                    value={values.correspondenceAddress?.city || ""}
                    onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, city: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="State"
                      value={values.correspondenceAddress?.state || ""}
                      onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, state: e.target.value })}
                    />
                    <Input
                      placeholder="ZIP"
                      value={values.correspondenceAddress?.zip || ""}
                      onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, zip: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="Country"
                    value={values.correspondenceAddress?.country || ""}
                    onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, country: e.target.value })}
                  />
                  <Input
                    placeholder="Telephone"
                    value={values.correspondenceAddress?.phone || ""}
                    onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, phone: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    value={values.correspondenceAddress?.email || ""}
                    onChange={(e) => setValue("correspondenceAddress", { ...values.correspondenceAddress, email: e.target.value })}
                    className="sm:col-span-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Inventors & Ownership ──────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="h-5 w-5" />
              Inventors & Ownership
            </CardTitle>
            <CardDescription>
              Enter inventor details as required by PTO/SB/16 cover sheet. Include given name, family name, and city/state or country of residence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Inventor(s)</Label>
              {inventorFields.map((field, index) => (
                <div key={field.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Inventor {index + 1}
                    </span>
                    {inventorFields.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeInventor(index)}>
                        <X className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Given Name (first and middle) *</Label>
                      <Input
                        placeholder="e.g., John Michael"
                        value={values.inventors[index]?.givenName || ""}
                        onChange={(e) => setValue(`inventors.${index}.givenName`, e.target.value)}
                      />
                      {form.formState.errors.inventors?.[index]?.givenName && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.inventors[index]?.givenName?.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Family Name or Surname *</Label>
                      <Input
                        placeholder="e.g., Smith"
                        value={values.inventors[index]?.familyName || ""}
                        onChange={(e) => setValue(`inventors.${index}.familyName`, e.target.value)}
                      />
                      {form.formState.errors.inventors?.[index]?.familyName && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.inventors[index]?.familyName?.message}
                        </p>
                      )}
                    </div>
                    <Input
                      placeholder="City"
                      value={values.inventors[index]?.city || ""}
                      onChange={(e) => setValue(`inventors.${index}.city`, e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="State"
                        value={values.inventors[index]?.state || ""}
                        onChange={(e) => setValue(`inventors.${index}.state`, e.target.value)}
                      />
                      <Input
                        placeholder="Country"
                        value={values.inventors[index]?.country || ""}
                        onChange={(e) => setValue(`inventors.${index}.country`, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addInventor({ givenName: "", familyName: "", city: "", state: "", country: "US", email: "" })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Inventor
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Assignee / Owner</Label>
              <Input
                placeholder="Company or organization name (optional)"
                value={values.assignee || ""}
                onChange={(e) => setValue("assignee", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The entity that will own the patent rights. If left blank, rights belong to the inventor(s).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Invention Disclosure ───────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="h-5 w-5" />
              Invention Disclosure
            </CardTitle>
            <CardDescription>
              Provide structured details about your invention. The more detail you provide, the stronger your application will be.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Working Title <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., System and Method for Real-Time Translation Using Neural Networks"
                value={values.title}
                onChange={(e) => setValue("title", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Max 500 characters. AI can refine this later.</p>
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Technology Area</Label>
              <Input
                placeholder="e.g., Natural Language Processing, Machine Learning"
                value={values.technologyArea || ""}
                onChange={(e) => setValue("technologyArea", e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Problem Being Solved</Label>
              <Textarea
                placeholder="Describe the technical problem your invention addresses. What limitations exist in current solutions?"
                value={values.inventionProblem || ""}
                onChange={(e) => setValue("inventionProblem", e.target.value)}
                rows={4}
                className="resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Solution / How It Works</Label>
              <Textarea
                placeholder="Describe how your invention solves the problem. What is the technical approach?"
                value={values.inventionSolution || ""}
                onChange={(e) => setValue("inventionSolution", e.target.value)}
                rows={4}
                className="resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Invention Description</Label>
              <Textarea
                placeholder="Provide a comprehensive description of your invention including all details, embodiments, and variations..."
                value={values.inventionDescription || ""}
                onChange={(e) => setValue("inventionDescription", e.target.value)}
                rows={6}
                className="resize-y"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Key Features & Elements</Label>
              <p className="text-xs text-muted-foreground">
                List the key features of your invention. Mark which ones you believe are novel.
              </p>
              {featureFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start rounded-md border p-3">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Feature name"
                      value={values.keyFeatures[index]?.feature || ""}
                      onChange={(e) => setValue(`keyFeatures.${index}.feature`, e.target.value)}
                    />
                    <Input
                      placeholder="Brief description (optional)"
                      value={values.keyFeatures[index]?.description || ""}
                      onChange={(e) => setValue(`keyFeatures.${index}.description`, e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={values.keyFeatures[index]?.isNovel || false}
                        onCheckedChange={(v) => setValue(`keyFeatures.${index}.isNovel`, v === true)}
                      />
                      Novel
                    </label>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFeature(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addFeature({ feature: "", description: "", isNovel: false })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Feature
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Known Prior Art / Existing Solutions</Label>
              <Textarea
                placeholder="Describe any existing solutions, patents, or products you are aware of that are related to your invention..."
                value={values.knownPriorArt || ""}
                onChange={(e) => setValue("knownPriorArt", e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>

            <Separator />

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
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.svg,.txt,.md"
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
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFile(i)}>
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

      {/* ── Step 4: AI Interview ───────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="h-5 w-5" />
              AI Invention Interview
            </CardTitle>
            <CardDescription>
              The AI will analyze your disclosure and ask targeted follow-up questions to strengthen your application. You can skip this step if preferred.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {interviewSkipped ? (
              <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                <p className="text-muted-foreground">Interview skipped. You can always re-run it from the patent configuration page.</p>
                <Button variant="outline" onClick={() => setInterviewSkipped(false)}>
                  Start Interview
                </Button>
              </div>
            ) : (
              <InterviewChat
                disclosure={disclosureContext}
                onComplete={(responses) => {
                  setIntakeResponses(responses);
                }}
                existingResponses={intakeResponses}
              />
            )}
            {!interviewSkipped && intakeResponses.length === 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setInterviewSkipped(true)}>
                  Skip Interview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Related Applications & Government Funding ── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Link2 className="h-5 w-5" />
              Related Applications & Government Funding
            </CardTitle>
            <CardDescription>
              Declare any related patent applications and government contract information (PTO/SB/16 Page 2).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Related Applications</Label>
              <p className="text-xs text-muted-foreground">
                If this application claims priority to or is related to other applications, add them here.
                These will auto-populate the Cross-Reference section.
              </p>
              {relatedFields.map((field, index) => (
                <div key={field.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Select
                      value={values.relatedApplications[index]?.type || "provisional"}
                      onValueChange={(v) => setValue(`relatedApplications.${index}.type`, v as "provisional" | "continuation" | "divisional" | "cip")}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="provisional">Provisional</SelectItem>
                        <SelectItem value="continuation">Continuation</SelectItem>
                        <SelectItem value="divisional">Divisional</SelectItem>
                        <SelectItem value="cip">Continuation-in-Part</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeRelatedApp(index)}>
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      placeholder="Application Number"
                      value={values.relatedApplications[index]?.applicationNumber || ""}
                      onChange={(e) => setValue(`relatedApplications.${index}.applicationNumber`, e.target.value)}
                    />
                    <Input
                      type="date"
                      placeholder="Filing Date"
                      value={values.relatedApplications[index]?.filingDate || ""}
                      onChange={(e) => setValue(`relatedApplications.${index}.filingDate`, e.target.value)}
                    />
                    <Input
                      placeholder="Title"
                      value={values.relatedApplications[index]?.title || ""}
                      onChange={(e) => setValue(`relatedApplications.${index}.title`, e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRelatedApp({ type: "provisional", applicationNumber: "", filingDate: "", title: "" })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Related Application
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Government Contract Information</Label>
              <p className="text-xs text-muted-foreground">
                Per 35 U.S.C. 202(c)(6), if the invention was made with government support,
                the specification must contain a statement to that effect.
              </p>

              <div className="space-y-3 rounded-lg border p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={values.governmentContract?.isMadeByAgency || false}
                    onCheckedChange={(v) => setValue("governmentContract.isMadeByAgency", v === true)}
                  />
                  <span className="text-sm">The invention was made by an agency of the U.S. Government</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={values.governmentContract?.isUnderContract || false}
                    onCheckedChange={(v) => setValue("governmentContract.isUnderContract", v === true)}
                  />
                  <span className="text-sm">The invention was made under a contract with a U.S. Government agency</span>
                </label>

                {(values.governmentContract?.isMadeByAgency || values.governmentContract?.isUnderContract) && (
                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <Input
                      placeholder="U.S. Government Agency Name"
                      value={values.governmentContract?.agencyName || ""}
                      onChange={(e) => setValue("governmentContract.agencyName", e.target.value)}
                    />
                    {values.governmentContract?.isUnderContract && (
                      <Input
                        placeholder="Contract Number"
                        value={values.governmentContract?.contractNumber || ""}
                        onChange={(e) => setValue("governmentContract.contractNumber", e.target.value)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 6: CPC Codes ──────────────────────────────────── */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Globe className="h-5 w-5" />
              CPC Classification
            </CardTitle>
            <CardDescription>
              Select CPC codes to categorize your invention for prior art searches and patent examination.
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

              {(values.inventionDescription || values.inventionProblem || values.inventionSolution) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={fetchCpcSuggestions}
                  disabled={loadingSuggestions}
                >
                  {loadingSuggestions ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Get AI Suggestions</>
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
                      {selectedCpcCodes.includes(cpc.code) && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">{cpc.code}</Badge>
                        <span className="text-sm">{cpc.label}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 7: AI Models & Review ─────────────────────────── */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5" />
              AI Models & Review
            </CardTitle>
            <CardDescription>
              Choose AI model configuration and review your application setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Presets */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">AI Model Preset</Label>
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
                        <div className="text-xs text-muted-foreground leading-relaxed">{preset.description}</div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <Separator />

            {/* Review Summary */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Application Summary</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewItem label="Patent Type" value={values.type} />
                <ReviewItem label="Jurisdiction" value={JURISDICTION_LABELS[values.jurisdiction]} />
                <ReviewItem label="Entity Size" value={`${values.entitySize || "small"} entity`} />
                <ReviewItem label="Docket No." value={values.docketNumber || "Not specified"} />
                <ReviewItem
                  label="Inventors"
                  value={values.inventors.filter((i) => i.givenName).map((i) => `${i.givenName} ${i.familyName}`).join(", ") || "None"}
                />
                <ReviewItem label="Assignee" value={values.assignee || "Not specified"} />
              </div>

              <div className="border-t pt-3 space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">Title</span>
                <p className="text-sm">{values.title || "Not provided"}</p>
              </div>

              {values.inventionProblem && (
                <div className="border-t pt-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Problem</span>
                  <p className="text-sm text-muted-foreground line-clamp-2">{values.inventionProblem}</p>
                </div>
              )}

              {values.keyFeatures.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Key Features ({values.keyFeatures.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {values.keyFeatures.map((f, i) => (
                      <Badge key={i} variant={f.isNovel ? "default" : "secondary"} className="text-xs">
                        {f.feature} {f.isNovel && "(novel)"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {intakeResponses.length > 0 && (
                <div className="border-t pt-3">
                  <Badge variant="outline" className="text-xs gap-1">
                    <MessageSquare className="h-3 w-3" />
                    AI Interview: {intakeResponses.length} responses captured
                  </Badge>
                </div>
              )}

              {uploadedFiles.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Documents ({uploadedFiles.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {uploadedFiles.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{f.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedCpcCodes.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">CPC Codes</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedCpcCodes.map((code) => (
                      <Badge key={code} variant="secondary" className="font-mono text-xs">{code}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-3 space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">AI Models</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ModelTag role="Drafting" modelId={values.draftingModel as ModelId} />
                  <ModelTag role="Claims" modelId={values.claimsModel as ModelId} />
                  <ModelTag role="Analysis" modelId={values.analysisModel as ModelId} />
                  <span className="flex items-center justify-between rounded-md border px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">Image</span>
                    <span className="text-xs font-medium">{imageModelInfo[values.imageModel as ImageModelId]?.name || values.imageModel}</span>
                  </span>
                </div>
              </div>
            </div>

            {values.type === "provisional" && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-accent/50 rounded-md p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Provisional applications do not require formal claims, though optional claims may strengthen your filing.
                  The system will generate appropriate sections for a PPA.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={goBack} disabled={step === 0} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} className="gap-1.5">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={isPending || !values.title} className="gap-1.5">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Create Patent Project</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}

function ModelTag({ role, modelId }: { role: string; modelId: ModelId }) {
  const info = modelInfo[modelId];
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{role}</span>
      <span className="text-xs font-medium">{info?.name || modelId}</span>
    </div>
  );
}

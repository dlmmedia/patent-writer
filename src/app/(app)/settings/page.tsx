"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { checkApiKeyStatus } from "@/lib/actions/patents";
import {
  modelInfo,
  imageModelInfo,
  type ModelId,
  type ImageModelId,
} from "@/lib/ai/providers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Brain,
  Key,
  FileDown,
  Info,
} from "lucide-react";

const MODEL_IDS = Object.keys(modelInfo) as ModelId[];
const IMAGE_MODEL_IDS = Object.keys(imageModelInfo) as ImageModelId[];

const API_KEYS = [
  { name: "OpenAI", env: "OPENAI_API_KEY" },
  { name: "Google Generative AI", env: "GOOGLE_GENERATIVE_AI_API_KEY" },
  { name: "EPO OPS (Consumer Key)", env: "EPO_CONSUMER_KEY" },
  { name: "EPO OPS (Consumer Secret)", env: "EPO_CONSUMER_SECRET" },
  { name: "Vercel Blob Storage", env: "BLOB_READ_WRITE_TOKEN" },
];

export default function SettingsPage() {
  const {
    defaultDraftingModel,
    defaultClaimsModel,
    defaultAnalysisModel,
    defaultImageModel,
    setDefaultDraftingModel,
    setDefaultClaimsModel,
    setDefaultAnalysisModel,
    setDefaultImageModel,
  } = useAppStore();

  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function checkKeys() {
      const results: Record<string, boolean> = {};
      for (const key of API_KEYS) {
        try {
          results[key.env] = await checkApiKeyStatus(key.env);
        } catch {
          results[key.env] = false;
        }
      }
      setKeyStatus(results);
    }
    checkKeys();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="heading-serif text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Settings
        </h2>
        <p className="text-muted-foreground">
          Application preferences and default configuration
        </p>
      </div>

      {/* Default AI Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Default AI Models
          </CardTitle>
          <CardDescription>
            Set the default models applied to newly created patents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Drafting Model</Label>
              <Select
                value={defaultDraftingModel}
                onValueChange={(v) => setDefaultDraftingModel(v as ModelId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {modelInfo[id].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Claims Model</Label>
              <Select
                value={defaultClaimsModel}
                onValueChange={(v) => setDefaultClaimsModel(v as ModelId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {modelInfo[id].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Analysis Model</Label>
              <Select
                value={defaultAnalysisModel}
                onValueChange={(v) => setDefaultAnalysisModel(v as ModelId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {modelInfo[id].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Image Model</Label>
              <Select
                value={defaultImageModel}
                onValueChange={(v) => setDefaultImageModel(v as ImageModelId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODEL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {imageModelInfo[id].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Keys Status
          </CardTitle>
          <CardDescription>
            API keys are read from server environment variables. Green means
            the variable is set; red means it is missing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {API_KEYS.map((key) => {
              const isSet = keyStatus[key.env];
              const isLoaded = key.env in keyStatus;
              return (
                <div
                  key={key.env}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        !isLoaded
                          ? "bg-muted-foreground/30 animate-pulse"
                          : isSet
                            ? "bg-green-500"
                            : "bg-red-400"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {key.env}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={isLoaded && isSet ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {!isLoaded ? "Checking..." : isSet ? "Configured" : "Missing"}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Configure keys in your <code className="text-xs">.env.local</code> file
            or deployment environment.
          </p>
        </CardContent>
      </Card>

      {/* Export Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="h-4 w-4" />
            Export Defaults
          </CardTitle>
          <CardDescription>
            Default settings for document exports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select defaultValue="letter">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">US Letter (8.5 × 11)</SelectItem>
                  <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paragraph Numbering</Label>
              <Select defaultValue="bracket">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bracket">[0001] Bracket Style</SelectItem>
                  <SelectItem value="period">1. Period Style</SelectItem>
                  <SelectItem value="none">No Numbering</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Font Size (pt)</Label>
              <Input type="number" defaultValue={12} min={8} max={16} />
            </div>

            <div className="space-y-2">
              <Label>Line Spacing</Label>
              <Select defaultValue="double">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="1.5">1.5</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Version</span>
            <Badge variant="secondary">0.1.0</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Framework</span>
            <span className="text-sm text-muted-foreground">
              Next.js 16 + React 19
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Database</span>
            <span className="text-sm text-muted-foreground">
              Neon PostgreSQL + Drizzle ORM
            </span>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground pt-2">
            Patent Writer is an AI-powered patent drafting application. For
            documentation and support visit the project repository.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

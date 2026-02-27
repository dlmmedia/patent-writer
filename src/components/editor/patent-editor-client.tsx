"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatentEditor } from "./patent-editor";
import { updateSection } from "@/lib/actions/patents";
import { SECTION_LABELS } from "@/lib/types";
import type { SectionType, PatentSection, Patent } from "@/lib/types";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Save,
  Loader2,
  FileText,
  Copy,
  ArrowDownToLine,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";

interface PatentEditorClientProps {
  patent: Patent & { sections: PatentSection[] };
}

export function PatentEditorClient({ patent }: PatentEditorClientProps) {
  const [activeSection, setActiveSection] = useState<PatentSection>(
    patent.sections[0]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [aiInstructions, setAiInstructions] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const pendingContent = useRef<any>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<{ insertContent: (text: string) => void } | null>(null);

  const save = useCallback(
    async (content: any) => {
      if (!activeSection) return;

      setIsSaving(true);
      try {
        const plainText = extractPlainText(content);
        await updateSection(activeSection.id, {
          content: content as Record<string, unknown>,
          plainText,
        });
        setLastSaved(new Date());
      } catch {
        toast.error("Failed to save. Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [activeSection]
  );

  const handleChange = useCallback(
    (content: any) => {
      pendingContent.current = content;

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        if (pendingContent.current) {
          save(pendingContent.current);
        }
      }, 2000);
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const handleSectionSwitch = useCallback(
    (section: PatentSection) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      if (pendingContent.current) {
        save(pendingContent.current);
        pendingContent.current = null;
      }
      setActiveSection(section);
      setGeneratedContent("");
    },
    [save]
  );

  const handleGenerate = useCallback(async () => {
    if (!activeSection) return;

    setIsGenerating(true);
    setGeneratedContent("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType: activeSection.sectionType,
          model: aiModel,
          instructions: aiInstructions || undefined,
          context: `Patent title: ${patent.title}\n${patent.inventionDescription ? `Description: ${patent.inventionDescription}` : ""}`,
          jurisdiction: patent.jurisdiction,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Generation failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGeneratedContent(accumulated);
      }

      toast.success("Content generated successfully");
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast.info("Generation stopped");
      } else {
        toast.error(err?.message || "Failed to generate content");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [activeSection, aiModel, aiInstructions, patent]);

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleCopyGenerated = useCallback(() => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard");
  }, [generatedContent]);

  return (
    <ResizablePanelGroup orientation="horizontal" style={{ height: "100%", width: "100%" }}>
        {/* Section List */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="flex h-full flex-col border-r">
            <div className="shrink-0 border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Sections</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {patent.sections.length} sections
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-2 space-y-1">
                {patent.sections.map((section) => {
                  const hasContent =
                    section.plainText && section.plainText.trim().length > 0;
                  const isActive = activeSection?.id === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionSwitch(section)}
                      className={`w-full flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                        isActive
                          ? "bg-accent text-accent-foreground border-l-[3px] border-l-[oklch(0.72_0.12_85)] rounded-l-none"
                          : "hover:bg-muted/50 hover:translate-x-0.5"
                      }`}
                    >
                      {hasContent ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      ) : (
                        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-xs">
                          {SECTION_LABELS[
                            section.sectionType as SectionType
                          ] ?? section.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {section.wordCount ?? 0} words
                          {section.isAiGenerated ? " · AI" : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="flex h-full flex-col">
            <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {SECTION_LABELS[
                    activeSection?.sectionType as SectionType
                  ] ?? activeSection?.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Loader2 className="size-3 animate-spin" />
                    Saving
                  </Badge>
                )}
                {!isSaving && lastSaved && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Save className="size-3" />
                    Saved
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4">
                {activeSection && (
                  <PatentEditor
                    key={activeSection.id}
                    initialContent={
                      activeSection.content &&
                      Array.isArray(activeSection.content)
                        ? activeSection.content
                        : undefined
                    }
                    onChange={handleChange}
                    sectionType={activeSection.sectionType}
                  />
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* AI Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <div className="flex h-full flex-col border-l">
            <div className="shrink-0 border-b px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-4" />
                AI Assistant
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate content for this section
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Model</label>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.5-flash">
                        Gemini 2.5 Flash
                      </SelectItem>
                      <SelectItem value="gemini-2.5-pro">
                        Gemini 2.5 Pro
                      </SelectItem>
                      <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    Additional Instructions
                  </label>
                  <Textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder={`Provide specific guidance for generating the "${
                      SECTION_LABELS[
                        activeSection?.sectionType as SectionType
                      ] ?? "section"
                    }" section...`}
                    className="min-h-[120px] text-sm"
                  />
                </div>

                {isGenerating ? (
                  <Button
                    className="w-full gap-2 btn-press"
                    size="sm"
                    variant="destructive"
                    onClick={handleStopGeneration}
                  >
                    <StopCircle className="size-4" />
                    Stop Generating
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2 btn-press sparkle-hover text-white hover:opacity-90 shadow-sm"
                    style={{ background: "linear-gradient(135deg, oklch(0.27 0.05 260), oklch(0.33 0.06 260))" }}
                    size="sm"
                    onClick={handleGenerate}
                  >
                    <Sparkles className="size-4 sparkle-icon" />
                    Generate Content
                  </Button>
                )}

                <Separator />

                {generatedContent ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Generated Output</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={handleCopyGenerated}
                        >
                          <Copy className="size-3" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3 max-h-[400px] overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {generatedContent}
                      </p>
                      {isGenerating && (
                        <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-3">
                    <p className="text-xs text-muted-foreground text-center">
                      {isGenerating
                        ? "Generating content..."
                        : "AI generation will appear here. You can review and insert generated content into the editor."}
                    </p>
                    {isGenerating && (
                      <div className="flex justify-center mt-2">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function extractPlainText(content: any): string {
  if (!content || !Array.isArray(content)) return "";

  const texts: string[] = [];
  for (const node of content) {
    if (node.text !== undefined) {
      texts.push(node.text);
    }
    if (node.children) {
      texts.push(extractPlainText(node.children));
    }
  }
  return texts.join("").trim();
}

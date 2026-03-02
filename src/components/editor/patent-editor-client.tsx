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
import type { PatentEditorHandle } from "./patent-editor";
import { updateSection } from "@/lib/actions/patents";
import { SECTION_LABELS } from "@/lib/types";
import type { SectionType, PatentSection, Patent } from "@/lib/types";
import { modelInfo, type ModelId } from "@/lib/ai/providers";
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
  ChevronLeft,
  ChevronRight,
  Info,
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
  const [aiModel, setAiModel] = useState(
    (patent as any).aiModelConfig?.draftingModel ?? "gemini-2.5-flash"
  );
  const [aiInstructions, setAiInstructions] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(true);

  const pendingContent = useRef<any>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<PatentEditorHandle>(null);

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
        const errBody = await res.json().catch(() => null);
        throw new Error(
          errBody?.error || `Generation failed (${res.status})`
        );
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

  const handleInsertGenerated = useCallback(() => {
    if (!generatedContent.trim() || !editorRef.current) {
      toast.error("No content to insert");
      return;
    }
    editorRef.current.insertContent(generatedContent);
    toast.success("Content inserted into editor");
  }, [generatedContent]);

  const handleReplaceWithGenerated = useCallback(() => {
    if (!generatedContent.trim() || !editorRef.current) {
      toast.error("No content to replace with");
      return;
    }
    editorRef.current.replaceContent(generatedContent);
    toast.success("Section content replaced");
  }, [generatedContent]);

  const normalizedContent =
    activeSection?.content && Array.isArray(activeSection.content)
      ? activeSection.content
      : undefined;

  const currentModelInfo = modelInfo[aiModel as ModelId];

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full w-full min-h-0 min-w-0"
      >
        {/* Section List */}
        <ResizablePanel defaultSize={18} minSize={14} maxSize={25}>
          <div className="flex h-full min-w-0 flex-col border-r overflow-hidden">
            <div className="shrink-0 border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Sections</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {patent.sections.filter(
                  (s) => s.plainText && s.plainText.trim().length > 0
                ).length}
                /{patent.sections.length} complete
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {patent.sections.map((section) => {
                  const hasContent =
                    section.plainText && section.plainText.trim().length > 0;
                  const isActive = activeSection?.id === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionSwitch(section)}
                      className={`w-full flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-accent text-accent-foreground border-l-[3px] border-l-primary rounded-l-none"
                          : "hover:bg-muted/50"
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
        <ResizablePanel defaultSize={showAiPanel ? 50 : 82} minSize={30}>
          <div className="flex h-full min-w-0 flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <h3 className="text-sm font-semibold truncate">
                  {SECTION_LABELS[
                    activeSection?.sectionType as SectionType
                  ] ?? activeSection?.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  title={showAiPanel ? "Hide AI Panel" : "Show AI Panel"}
                >
                  {showAiPanel ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Patent context bar */}
            {patent.inventionDescription && (
              <div className="shrink-0 border-b bg-muted/30 px-4 py-2">
                <div className="flex items-start gap-2">
                  <Info className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    <span className="font-medium text-foreground">
                      {patent.title}
                    </span>
                    {" — "}
                    {patent.inventionDescription}
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4">
                {activeSection && (
                  <PatentEditor
                    key={activeSection.id}
                    ref={editorRef}
                    initialContent={normalizedContent}
                    onChange={handleChange}
                    sectionType={activeSection.sectionType}
                  />
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* AI Panel */}
        {showAiPanel && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={32} minSize={20} maxSize={45}>
              <div className="flex h-full min-w-0 flex-col border-l overflow-hidden">
                <div className="shrink-0 border-b px-4 py-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="size-4" />
                    AI Assistant
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Generate content for{" "}
                    <span className="font-medium">
                      {SECTION_LABELS[
                        activeSection?.sectionType as SectionType
                      ] ?? "this section"}
                    </span>
                  </p>
                </div>

                <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                  <div className="p-4 space-y-4 min-w-0">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Model</label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(modelInfo) as [
                              ModelId,
                              (typeof modelInfo)[ModelId],
                            ][]
                          ).map(([id, info]) => (
                            <SelectItem key={id} value={id}>
                              {info.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentModelInfo && (
                        <p className="text-[10px] text-muted-foreground">
                          {currentModelInfo.provider} ·{" "}
                          {currentModelInfo.bestFor}
                        </p>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2 min-w-0">
                      <label className="text-xs font-medium">
                        Instructions (optional)
                      </label>
                      <Textarea
                        value={aiInstructions}
                        onChange={(e) => setAiInstructions(e.target.value)}
                        placeholder={`Provide guidance for generating the "${
                          SECTION_LABELS[
                            activeSection?.sectionType as SectionType
                          ] ?? "section"
                        }" section...`}
                        className="min-h-[80px] text-sm resize-y"
                      />
                    </div>

                    {isGenerating ? (
                      <Button
                        className="w-full gap-2"
                        size="sm"
                        variant="destructive"
                        onClick={handleStopGeneration}
                      >
                        <StopCircle className="size-4" />
                        Stop Generating
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2 text-white hover:opacity-90 shadow-sm"
                        style={{
                          background:
                            "linear-gradient(135deg, oklch(0.27 0.05 260), oklch(0.33 0.06 260))",
                        }}
                        size="sm"
                        onClick={handleGenerate}
                      >
                        <Sparkles className="size-4" />
                        Generate Content
                      </Button>
                    )}

                    <Separator />

                    {generatedContent ? (
                      <div className="space-y-3 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">
                            Generated Output
                          </span>
                          <div className="flex gap-1 shrink-0">
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
                        <div className="rounded-md border bg-muted/30 p-3 max-h-[400px] overflow-y-auto overflow-x-hidden">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                            {generatedContent}
                          </p>
                          {isGenerating && (
                            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                          )}
                        </div>

                        {!isGenerating && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={handleInsertGenerated}
                            >
                              <ArrowDownToLine className="size-3.5" />
                              Insert
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1.5"
                              onClick={handleReplaceWithGenerated}
                            >
                              <FileText className="size-3.5" />
                              Replace
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-4">
                        <p className="text-xs text-muted-foreground text-center">
                          {isGenerating ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="size-4 animate-spin" />
                              Generating content...
                            </span>
                          ) : (
                            "Click Generate to create AI-drafted content for this section. You can then insert or replace the editor content."
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
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

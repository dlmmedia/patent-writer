"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import type {
  SectionType,
  PatentSection,
  PatentWithRelations,
  PatentDocument,
  ReferenceNumeral,
} from "@/lib/types";
import { modelInfo, MODEL_PROVIDER_MAP, type ModelId } from "@/lib/ai/providers";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Loader2,
  Copy,
  ArrowDownToLine,
  FileText,
  StopCircle,
  X,
  Wand2,
  ChevronDown,
  ChevronUp,
  Upload,
  Paperclip,
  Trash2,
  AlertCircle,
  ImageIcon,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

type GenerateAllStatus = "idle" | "running" | "complete" | "error";

interface SectionGenerationState {
  section: string;
  status: "pending" | "generating" | "complete" | "error" | "skipped";
  content?: string;
  error?: string;
}

interface FigureGenerationState {
  figureNumber: string;
  label: string;
  figureType: string;
  status: "pending" | "generating" | "complete" | "error";
  error?: string;
}

type FigurePhase = "idle" | "analyzing" | "generating" | "complete";

function textToEditorContent(text: string) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) return [{ type: "p", children: [{ text }] }];
  return paragraphs.map((p) => ({
    type: "p" as const,
    children: [{ text: p.trim() }],
  }));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PatentEditorClient({
  patent,
}: {
  patent: PatentWithRelations;
}) {
  const router = useRouter();

  const [localSections, setLocalSections] = useState(patent.sections);
  const [activeSectionId, setActiveSectionId] = useState(
    patent.sections[0]?.id
  );
  const [editorKey, setEditorKey] = useState(0);

  const activeSection = useMemo(
    () =>
      localSections.find((s) => s.id === activeSectionId) || localSections[0],
    [localSections, activeSectionId]
  );

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [aiModel, setAiModel] = useState(() => {
    const stored = patent.aiModelConfig?.draftingModel;
    if (stored && stored in MODEL_PROVIDER_MAP) return stored;
    return "gemini-3.1-pro";
  });
  const [aiInstructions, setAiInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  const [generateAllStatus, setGenerateAllStatus] =
    useState<GenerateAllStatus>("idle");
  const [sectionStates, setSectionStates] = useState<
    SectionGenerationState[]
  >([]);
  const [showGenerateAllPanel, setShowGenerateAllPanel] = useState(false);

  const [figureStates, setFigureStates] = useState<FigureGenerationState[]>([]);
  const [figurePhase, setFigurePhase] = useState<FigurePhase>("idle");

  // Document upload state
  const [documents, setDocuments] = useState<PatentDocument[]>(
    patent.documents || []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [showDocsPanel, setShowDocsPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showRefCheck, setShowRefCheck] = useState(false);
  const [refCheckResults, setRefCheckResults] = useState<{ numeral: number; name: string; inSpec: boolean; inDrawings: boolean }[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const generateAllAbortRef = useRef<AbortController | null>(null);
  const pendingContent = useRef<any>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<PatentEditorHandle>(null);
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  const save = useCallback(
    async (content: any) => {
      if (!activeSection) return;
      setSaveStatus("saving");
      try {
        const plainText = extractPlainText(content);
        await updateSection(activeSection.id, {
          content: content as Record<string, unknown>,
          plainText,
        });
        setLocalSections((prev) =>
          prev.map((s) =>
            s.id === activeSection.id
              ? {
                  ...s,
                  content,
                  plainText,
                  wordCount: plainText.split(/\s+/).filter(Boolean).length,
                }
              : s
          )
        );
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
        toast.error("Failed to save.");
      }
    },
    [activeSection]
  );

  const handleChange = useCallback(
    (content: any) => {
      pendingContent.current = content;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (pendingContent.current) save(pendingContent.current);
      }, 2000);
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function handleSectionSwitch(section: PatentSection) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (pendingContent.current) {
      save(pendingContent.current);
      pendingContent.current = null;
    }
    setActiveSectionId(section.id);
    setGeneratedContent("");
  }

  function getExistingSections(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const s of localSections) {
      if (s.plainText && s.plainText.trim().length > 10) {
        result[s.sectionType] = s.plainText;
      }
    }
    return result;
  }

  // ─── Document Upload ──────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("patentId", patent.id);

        const res = await fetch("/api/patents/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Upload failed");
        }

        const doc = await res.json();
        setDocuments((prev) => [doc, ...prev]);
        uploadedCount++;
      } catch (err: any) {
        errorCount++;
        toast.error(`Failed to upload ${file.name}: ${err?.message || "Unknown error"}`);
      }
    }

    if (uploadedCount > 0) {
      toast.success(
        `${uploadedCount} document${uploadedCount > 1 ? "s" : ""} uploaded`
      );
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteDocument(docId: string) {
    try {
      const res = await fetch(`/api/patents/documents?id=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed");
    } catch {
      toast.error("Failed to remove document");
    }
  }

  // ─── Single Section Generation ────────────────────────────

  async function handleGenerate() {
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
          existingSections: getExistingSections(),
          patentId: patent.id,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Generation failed (${res.status})`);
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
      toast.success("Content generated");
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error(err?.message || "Failed to generate");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }

  async function handleGenerateAndInsert() {
    if (!activeSection) return;
    setIsGenerating(true);
    setGeneratedContent("");
    setShowAiPanel(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType: activeSection.sectionType,
          model: aiModel,
          context: `Patent title: ${patent.title}\n${patent.inventionDescription ? `Description: ${patent.inventionDescription}` : ""}`,
          jurisdiction: patent.jurisdiction,
          existingSections: getExistingSections(),
          patentId: patent.id,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Generation failed (${res.status})`);
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

      if (accumulated.trim()) {
        const contentNodes = textToEditorContent(accumulated);
        await updateSection(activeSection.id, {
          content: contentNodes as unknown as Record<string, unknown>,
          plainText: accumulated,
        });

        setLocalSections((prev) =>
          prev.map((s) =>
            s.id === activeSection.id
              ? {
                  ...s,
                  plainText: accumulated,
                  content: contentNodes as any,
                  wordCount: accumulated.split(/\s+/).filter(Boolean).length,
                }
              : s
          )
        );

        setEditorKey((k) => k + 1);
        toast.success("Content generated and inserted");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error(err?.message || "Failed to generate");
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }

  // ─── Generate All Sections ────────────────────────────────

  async function handleGenerateAll() {
    const controller = new AbortController();
    generateAllAbortRef.current = controller;
    setGenerateAllStatus("running");
    setShowGenerateAllPanel(true);
    setSectionStates([]);
    setFigureStates([]);
    setFigurePhase("idle");

    let errorCount = 0;
    let completedCount = 0;
    const errorMessages: string[] = [];

    try {
      const res = await fetch("/api/ai/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patentId: patent.id,
          model: aiModel,
          skipExisting: true,
          generateFigures: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Generation failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";

      function processLine(line: string) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.section && data.error) {
              errorCount++;
              errorMessages.push(`${data.section}: ${data.error}`);
            }
            if (
              data.section &&
              data.content !== undefined &&
              data.error === undefined
            ) {
              completedCount++;
            }
            handleSSEEvent(data);
          } catch {
            // skip malformed JSON
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("event: ")) {
            processLine(line);
          }
        }
      }

      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          processLine(line);
        }
      }

      if (errorCount > 0 && completedCount === 0) {
        setGenerateAllStatus("error");
        const firstError = errorMessages[0] || "Unknown error";
        toast.error(`Generation failed: ${firstError}`);
      } else if (errorCount > 0) {
        setGenerateAllStatus("complete");
        toast.warning(
          `Generated ${completedCount} section(s) with ${errorCount} error(s). Check the progress panel for details.`
        );
      } else if (completedCount === 0) {
        setGenerateAllStatus("complete");
        toast.info("All sections already have content. Nothing to generate.");
      } else {
        setGenerateAllStatus("complete");
        toast.success(
          `${completedCount} section(s) generated successfully!`
        );
      }

      setEditorKey((k) => k + 1);
      router.refresh();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setGenerateAllStatus("error");
        toast.error(err?.message || "Generation failed");
      } else {
        setGenerateAllStatus("idle");
      }
    } finally {
      generateAllAbortRef.current = null;
    }
  }

  function handleSSEEvent(data: any) {
    // Section events
    if (data.totalSections !== undefined) {
      const sections = (data.sections as string[]) || [];
      setSectionStates(
        sections.map((s) => ({ section: s, status: "pending" }))
      );
    } else if (data.section && data.chunk !== undefined) {
      setSectionStates((prev) =>
        prev.map((s) =>
          s.section === data.section ? { ...s, status: "generating" } : s
        )
      );
    } else if (
      data.section &&
      data.content !== undefined &&
      data.error === undefined
    ) {
      setSectionStates((prev) =>
        prev.map((s) =>
          s.section === data.section
            ? {
                ...s,
                status: data.skipped ? "skipped" : "complete",
                content: data.content,
              }
            : s
        )
      );
      if (data.content && !data.skipped) {
        const text: string = data.content;
        const editorContent = textToEditorContent(text);

        setLocalSections((prev) =>
          prev.map((s) =>
            s.sectionType === data.section
              ? {
                  ...s,
                  plainText: text,
                  content: editorContent as any,
                  wordCount: text.split(/\s+/).filter(Boolean).length,
                }
              : s
          )
        );
      }
    } else if (data.section && data.error) {
      setSectionStates((prev) =>
        prev.map((s) =>
          s.section === data.section
            ? { ...s, status: "error", error: data.error }
            : s
        )
      );
    }

    // Figure events
    if (data.message === "Analyzing required figures...") {
      setFigurePhase("analyzing");
    } else if (data.total !== undefined && data.figures !== undefined) {
      setFigurePhase("generating");
      setFigureStates(
        (data.figures as { figureNumber: string; label: string; figureType: string }[]).map(
          (f) => ({
            figureNumber: f.figureNumber,
            label: f.label,
            figureType: f.figureType,
            status: "pending",
          })
        )
      );
    } else if (data.figureNumber && data.label && !data.drawingId && !data.error) {
      setFigureStates((prev) =>
        prev.map((f) =>
          f.figureNumber === data.figureNumber
            ? { ...f, status: "generating" }
            : f
        )
      );
    } else if (data.figureNumber && data.drawingId) {
      setFigureStates((prev) =>
        prev.map((f) =>
          f.figureNumber === data.figureNumber
            ? { ...f, status: "complete" }
            : f
        )
      );
    } else if (data.figureNumber && data.error) {
      setFigureStates((prev) =>
        prev.map((f) =>
          f.figureNumber === data.figureNumber
            ? { ...f, status: "error", error: data.error }
            : f
        )
      );
    } else if (data.message === "All figures generated") {
      setFigurePhase("complete");
    }
  }

  function handleInsert() {
    if (!generatedContent.trim() || !editorRef.current) return;
    editorRef.current.insertContent(generatedContent);
    toast.success("Inserted into editor");
  }

  async function handleReplace() {
    if (!generatedContent.trim() || !activeSection) return;
    const contentNodes = textToEditorContent(generatedContent);

    await updateSection(activeSection.id, {
      content: contentNodes as unknown as Record<string, unknown>,
      plainText: generatedContent,
    });

    setLocalSections((prev) =>
      prev.map((s) =>
        s.id === activeSection.id
          ? {
              ...s,
              plainText: generatedContent,
              content: contentNodes as any,
              wordCount: generatedContent.split(/\s+/).filter(Boolean).length,
            }
          : s
      )
    );

    setEditorKey((k) => k + 1);
    toast.success("Content replaced");
  }

  const WORD_TARGETS: Partial<Record<SectionType, number>> = {
    field_of_invention: 50,
    background: 300,
    summary: 300,
    brief_description_drawings: 100,
    detailed_description: 1500,
    claims: 200,
    abstract: 50,
  };

  function checkRefNumeralConsistency() {
    const specText = localSections
      .filter((s) => s.sectionType === "detailed_description" || s.sectionType === "brief_description_drawings")
      .map((s) => s.plainText || "")
      .join(" ");

    const refNumerals = (patent.referenceNumerals || []) as ReferenceNumeral[];

    const results = refNumerals.map((rn) => {
      const pattern = new RegExp(`\\b${rn.numeral}\\b`);
      return {
        numeral: rn.numeral,
        name: rn.elementName,
        inSpec: pattern.test(specText),
        inDrawings: !!rn.firstFigureId,
      };
    });

    setRefCheckResults(results);
    setShowRefCheck(true);
  }

  const normalizedContent =
    activeSection?.content && Array.isArray(activeSection.content)
      ? activeSection.content
      : undefined;

  const sectionsDone = localSections.filter(
    (s) => s.plainText && s.plainText.trim().length > 10
  ).length;
  const totalWords = localSections.reduce(
    (sum, s) => sum + (s.wordCount ?? 0),
    0
  );

  const totalItems = sectionStates.length + figureStates.length;
  const doneItems =
    sectionStates.filter(
      (s) =>
        s.status === "complete" ||
        s.status === "error" ||
        s.status === "skipped"
    ).length +
    figureStates.filter(
      (f) => f.status === "complete" || f.status === "error"
    ).length;
  const generateAllProgress =
    totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="flex h-full">
      {/* Sidebar - section list */}
      <div className="w-56 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <p className="text-xs font-semibold">Sections</p>
          <p className="text-[11px] text-muted-foreground">
            {sectionsDone}/{localSections.length} done ·{" "}
            {totalWords.toLocaleString()} words
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {localSections.map((section) => {
            const done =
              section.plainText && section.plainText.trim().length > 10;
            const active = activeSection?.id === section.id;
            const wc = section.wordCount ?? 0;
            const target = WORD_TARGETS[section.sectionType as SectionType];
            const pct = target ? Math.min(100, Math.round((wc / target) * 100)) : (done ? 100 : 0);
            return (
              <button
                key={section.id}
                onClick={() => handleSectionSwitch(section)}
                className={`w-full rounded-md px-2.5 py-2 text-left text-xs transition-colors mb-0.5 ${
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle2
                      className={`size-3.5 shrink-0 ${active ? "text-primary-foreground" : pct >= 100 ? "text-green-500" : "text-blue-500"}`}
                    />
                  ) : (
                    <Circle
                      className={`size-3.5 shrink-0 ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    />
                  )}
                  <span className="truncate flex-1">
                    {SECTION_LABELS[section.sectionType as SectionType] ??
                      section.title}
                  </span>
                  <span className={`text-[10px] tabular-nums shrink-0 ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {wc}{target ? `/${target}` : ""}
                  </span>
                </div>
                {target && done && (
                  <div className={`mt-1 ml-5.5 h-0.5 rounded-full overflow-hidden ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? (active ? "bg-primary-foreground" : "bg-green-500") :
                        pct >= 50 ? (active ? "bg-primary-foreground/70" : "bg-blue-500") :
                        (active ? "bg-primary-foreground/50" : "bg-amber-500")
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Reference Numeral Consistency Check */}
        {patent.referenceNumerals && patent.referenceNumerals.length > 0 && (
          <div className="border-t px-2 py-2">
            <button
              onClick={checkRefNumeralConsistency}
              className="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <Hash className="size-3" />
              Check Ref. Numerals ({patent.referenceNumerals.length})
            </button>
            {showRefCheck && refCheckResults.length > 0 && (
              <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {refCheckResults.map((r) => (
                  <div key={r.numeral} className="flex items-center gap-1.5 text-[10px] px-2 py-0.5">
                    {r.inSpec && r.inDrawings ? (
                      <CheckCircle2 className="size-2.5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="size-2.5 text-amber-500 shrink-0" />
                    )}
                    <span className="font-mono">{r.numeral}</span>
                    <span className="truncate text-muted-foreground">{r.name}</span>
                    {!r.inSpec && <Badge variant="outline" className="text-[8px] h-3 px-1 ml-auto shrink-0">not in spec</Badge>}
                    {!r.inDrawings && <Badge variant="outline" className="text-[8px] h-3 px-1 shrink-0">no fig</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reference Documents */}
        <div className="border-t">
          <button
            onClick={() => setShowDocsPanel(!showDocsPanel)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Paperclip className="size-3.5" />
              References
              {documents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {documents.length}
                </Badge>
              )}
            </span>
            {showDocsPanel ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>

          {showDocsPanel && (
            <div className="px-2 pb-2 space-y-1.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] group"
                >
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{doc.fileName}</p>
                    <p className="text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteDocument(doc.id)}
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              ))}

              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                  {isUploading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Upload className="size-3" />
                  )}
                  {isUploading ? "Uploading..." : "Upload Document"}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>

              {documents.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-1">
                  Upload PDFs, DOCX, or text files as reference for AI
                  generation.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Generate All button */}
        <div className="p-2 border-t">
          <Button
            className="w-full gap-1.5 text-xs"
            size="sm"
            onClick={handleGenerateAll}
            disabled={generateAllStatus === "running"}
          >
            {generateAllStatus === "running" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wand2 className="size-3.5" />
            )}
            {generateAllStatus === "running"
              ? "Generating..."
              : "Generate All Sections"}
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Generate All Progress Panel */}
        {showGenerateAllPanel && generateAllStatus !== "idle" && (
          <div className="border-b bg-muted/20 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {generateAllStatus === "running" && (
                  <Loader2 className="size-4 animate-spin text-primary" />
                )}
                {generateAllStatus === "complete" && (
                  <CheckCircle2 className="size-4 text-green-500" />
                )}
                {generateAllStatus === "error" && (
                  <AlertCircle className="size-4 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {generateAllStatus === "running"
                    ? figurePhase === "analyzing"
                      ? "Analyzing required figures..."
                      : figurePhase === "generating"
                        ? "Generating patent figures..."
                        : "Generating patent sections..."
                    : generateAllStatus === "complete"
                      ? "Generation complete"
                      : "Generation encountered errors"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {generateAllStatus === "running" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => generateAllAbortRef.current?.abort()}
                  >
                    <StopCircle className="size-3 mr-1" /> Cancel
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => {
                    setShowGenerateAllPanel(false);
                    if (generateAllStatus !== "running") {
                      setGenerateAllStatus("idle");
                    }
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
            <Progress value={generateAllProgress} className="h-1.5 mb-2" />
            <div className="grid grid-cols-3 gap-1.5">
              {sectionStates.map((s) => (
                <div
                  key={s.section}
                  className="flex items-center gap-1.5 text-[11px]"
                  title={s.error || undefined}
                >
                  {s.status === "pending" && (
                    <Circle className="size-2.5 text-muted-foreground" />
                  )}
                  {s.status === "generating" && (
                    <Loader2 className="size-2.5 animate-spin text-primary" />
                  )}
                  {s.status === "complete" && (
                    <CheckCircle2 className="size-2.5 text-green-500" />
                  )}
                  {s.status === "skipped" && (
                    <CheckCircle2 className="size-2.5 text-muted-foreground" />
                  )}
                  {s.status === "error" && (
                    <AlertCircle className="size-2.5 text-destructive" />
                  )}
                  <span
                    className={`truncate ${
                      s.status === "skipped"
                        ? "text-muted-foreground"
                        : s.status === "error"
                          ? "text-destructive"
                          : ""
                    }`}
                  >
                    {SECTION_LABELS[s.section as SectionType] ??
                      s.section.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>

            {/* Figure generation progress */}
            {figurePhase !== "idle" && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-1.5 mb-2">
                  {figurePhase === "analyzing" && (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  )}
                  {figurePhase === "generating" && (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  )}
                  {figurePhase === "complete" && (
                    <CheckCircle2 className="size-3 text-green-500" />
                  )}
                  <span className="text-[11px] font-medium flex items-center gap-1">
                    <ImageIcon className="size-3" />
                    {figurePhase === "analyzing"
                      ? "Analyzing required figures..."
                      : figurePhase === "generating"
                        ? "Generating figures..."
                        : "Figures complete"}
                  </span>
                </div>
                {figureStates.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {figureStates.map((f) => (
                      <div
                        key={f.figureNumber}
                        className="flex items-center gap-1.5 text-[11px]"
                        title={f.error || undefined}
                      >
                        {f.status === "pending" && (
                          <Circle className="size-2.5 text-muted-foreground" />
                        )}
                        {f.status === "generating" && (
                          <Loader2 className="size-2.5 animate-spin text-primary" />
                        )}
                        {f.status === "complete" && (
                          <CheckCircle2 className="size-2.5 text-green-500" />
                        )}
                        {f.status === "error" && (
                          <AlertCircle className="size-2.5 text-destructive" />
                        )}
                        <span
                          className={`truncate ${
                            f.status === "error" ? "text-destructive" : ""
                          }`}
                        >
                          FIG. {f.figureNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Errors */}
            {(sectionStates.some((s) => s.status === "error" && s.error) ||
              figureStates.some((f) => f.status === "error" && f.error)) && (
              <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2">
                <p className="text-[11px] font-medium text-destructive mb-1">
                  Errors:
                </p>
                {sectionStates
                  .filter((s) => s.status === "error" && s.error)
                  .map((s) => (
                    <p
                      key={s.section}
                      className="text-[10px] text-destructive/80"
                    >
                      {SECTION_LABELS[s.section as SectionType] ??
                        s.section}
                      : {s.error}
                    </p>
                  ))}
                {figureStates
                  .filter((f) => f.status === "error" && f.error)
                  .map((f) => (
                    <p
                      key={f.figureNumber}
                      className="text-[10px] text-destructive/80"
                    >
                      FIG. {f.figureNumber} ({f.label}): {f.error}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Toolbar bar */}
        <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {SECTION_LABELS[activeSection?.sectionType as SectionType] ??
                activeSection?.title}
            </span>
            {saveStatus === "saving" && (
              <Badge variant="secondary" className="gap-1 text-[10px] ml-2">
                <Loader2 className="size-2.5 animate-spin" /> Saving
              </Badge>
            )}
            {saveStatus === "saved" && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] ml-2 text-green-600"
              >
                <CheckCircle2 className="size-2.5" /> Saved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {documents.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 text-muted-foreground"
              >
                <Paperclip className="size-2.5" />
                {documents.length} ref{documents.length > 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={handleGenerateAndInsert}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              {isGenerating ? "Generating..." : "Auto Generate"}
            </Button>
            <Button
              variant={showAiPanel ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={() => setShowAiPanel(!showAiPanel)}
            >
              <Sparkles className="size-3.5" />
              {showAiPanel ? "Hide AI" : "AI Panel"}
            </Button>
          </div>
        </div>

        {/* Editor + AI panel side by side */}
        <div className="flex-1 flex min-h-0">
          {/* Editor scroll area */}
          <div className="flex-1 overflow-y-auto min-w-0">
            <div className="max-w-3xl mx-auto py-6 px-6">
              {activeSection && (
                <PatentEditor
                  key={`${activeSection.id}-${editorKey}`}
                  ref={editorRef}
                  initialContent={normalizedContent}
                  onChange={handleChange}
                  sectionType={activeSection.sectionType}
                />
              )}
            </div>
          </div>

          {/* AI Panel */}
          {showAiPanel && (
            <div className="w-80 shrink-0 border-l flex flex-col bg-muted/20">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> AI Assistant
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setShowAiPanel(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium">Model</label>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(modelInfo) as [
                          ModelId,
                          (typeof modelInfo)[ModelId],
                        ][]
                      ).map(([id, info]) => (
                        <SelectItem key={id} value={id} className="text-xs">
                          {info.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <button
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                    Custom Instructions (optional)
                  </button>
                  {showAdvanced && (
                    <Textarea
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                      placeholder="Add specific instructions for generation..."
                      className="min-h-[60px] text-xs resize-y"
                    />
                  )}
                </div>

                {documents.length > 0 && (
                  <div className="rounded-md bg-accent/50 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Paperclip className="size-2.5" />
                      {documents.length} reference document
                      {documents.length > 1 ? "s" : ""} will be used for
                      context
                    </p>
                  </div>
                )}

                {isGenerating ? (
                  <Button
                    className="w-full gap-1.5 text-xs"
                    size="sm"
                    variant="destructive"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <StopCircle className="size-3.5" /> Stop
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-1.5 text-xs"
                    size="sm"
                    onClick={handleGenerate}
                  >
                    <Sparkles className="size-3.5" /> Generate
                  </Button>
                )}

                {(generatedContent || isGenerating) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium">Output</span>
                      {generatedContent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-1.5"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedContent);
                            toast.success("Copied");
                          }}
                        >
                          <Copy className="size-2.5" /> Copy
                        </Button>
                      )}
                    </div>
                    <div className="rounded border bg-background p-2.5 max-h-64 overflow-y-auto">
                      <p className="text-xs whitespace-pre-wrap leading-relaxed break-words">
                        {generatedContent}
                        {isGenerating && (
                          <span className="inline-block w-1 h-3 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                        )}
                      </p>
                    </div>
                    {generatedContent && !isGenerating && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="flex-1 gap-1 text-xs h-7"
                          onClick={handleInsert}
                        >
                          <ArrowDownToLine className="size-3" /> Insert
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs h-7"
                          onClick={handleReplace}
                        >
                          <FileText className="size-3" /> Replace
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {!generatedContent && !isGenerating && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">
                    Click Generate to create AI content for this section, or use
                    Auto Generate in the toolbar for one-click generation.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function extractPlainText(content: any): string {
  if (!content || !Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const node of content) {
    if (node.text !== undefined) texts.push(node.text);
    if (node.children) texts.push(extractPlainText(node.children));
  }
  return texts.join("").trim();
}

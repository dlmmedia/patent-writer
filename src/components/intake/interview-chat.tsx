"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Send,
  Bot,
  UserIcon,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

interface InventionDisclosure {
  title: string;
  inventionDescription: string;
  inventionProblem: string;
  inventionSolution: string;
  technologyArea: string;
  keyFeatures: { feature: string; description?: string; isNovel?: boolean }[];
  knownPriorArt: string;
}

interface InterviewResponse {
  question: string;
  answer: string;
  round: number;
}

interface InterviewChatProps {
  disclosure: InventionDisclosure;
  onComplete: (responses: InterviewResponse[]) => void;
  existingResponses?: InterviewResponse[];
}

interface ChatMessage {
  role: "ai" | "user";
  content: string;
  round?: number;
}

export function InterviewChat({
  disclosure,
  onComplete,
  existingResponses = [],
}: InterviewChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(existingResponses.length > 0);
  const [allResponses, setAllResponses] = useState<InterviewResponse[]>(existingResponses);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (existingResponses.length > 0 && !initialized.current) {
      initialized.current = true;
      const msgs: ChatMessage[] = [];
      for (const r of existingResponses) {
        msgs.push({ role: "ai", content: r.question, round: r.round });
        msgs.push({ role: "user", content: r.answer, round: r.round });
      }
      setMessages(msgs);
      setCompleted(true);
    }
  }, [existingResponses]);

  async function startInterview() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disclosure,
          previousResponses: [],
          round: 1,
        }),
      });

      if (!res.ok) throw new Error("Failed to start interview");
      const data = await res.json();

      const questions: string[] = data.questions || [];
      setCurrentQuestions(questions);
      setRound(1);
      setAnswers({});

      const aiMessage = questions
        .map((q: string, i: number) => `**Question ${i + 1}:** ${q}`)
        .join("\n\n");
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: aiMessage, round: 1 },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "I wasn't able to generate questions at this time. You can skip this step and proceed.",
          round: 0,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswers() {
    if (loading) return;

    const newResponses: InterviewResponse[] = currentQuestions.map(
      (q, i) => ({
        question: q,
        answer: answers[i] || "",
        round,
      })
    );

    const combined = [...allResponses, ...newResponses];
    setAllResponses(combined);

    const userMessage = currentQuestions
      .map((_, i) => `**Answer ${i + 1}:** ${answers[i] || "(skipped)"}`)
      .join("\n\n");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, round },
    ]);

    if (round >= 3) {
      setCompleted(true);
      onComplete(combined);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Thank you for your detailed responses. The interview is complete. Your answers will be used to strengthen the patent application.",
          round,
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disclosure,
          previousResponses: combined,
          round: round + 1,
        }),
      });

      if (!res.ok) throw new Error("Failed to get follow-up questions");
      const data = await res.json();
      const questions: string[] = data.questions || [];

      if (questions.length === 0) {
        setCompleted(true);
        onComplete(combined);
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content:
              "Your disclosure is comprehensive. No further questions are needed. The interview is complete.",
            round: round + 1,
          },
        ]);
        return;
      }

      setCurrentQuestions(questions);
      setRound(round + 1);
      setAnswers({});

      const aiMessage = questions
        .map((q: string, i: number) => `**Follow-up ${i + 1}:** ${q}`)
        .join("\n\n");
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: aiMessage, round: round + 1 },
      ]);
    } catch {
      setCompleted(true);
      onComplete(combined);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Interview complete. Your responses have been captured.",
          round: round + 1,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetInterview() {
    setMessages([]);
    setCurrentQuestions([]);
    setAnswers({});
    setRound(0);
    setCompleted(false);
    setAllResponses([]);
    onComplete([]);
    initialized.current = false;
  }

  const hasDisclosureContent =
    disclosure.inventionDescription ||
    disclosure.inventionProblem ||
    disclosure.inventionSolution;

  if (!hasDisclosureContent) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
        <p className="text-muted-foreground">
          Please provide an invention description, problem, or solution in the
          previous step before starting the AI interview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <Bot className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            The AI patent attorney will review your disclosure and ask targeted
            questions to identify gaps, additional embodiments, and claim scope
            opportunities.
          </p>
          <Button onClick={startInterview}>
            <Bot className="h-4 w-4 mr-2" />
            Start AI Interview
          </Button>
        </div>
      )}

      {messages.length > 0 && (
        <ScrollArea className="h-[400px] rounded-lg border p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "ai" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <div className="rounded-lg px-4 py-3 bg-muted text-sm text-muted-foreground">
                  Analyzing your disclosure...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {currentQuestions.length > 0 && !completed && !loading && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Round {round} of 3</Badge>
            <span className="text-xs text-muted-foreground">
              Answer the questions below. You can leave any blank to skip.
            </span>
          </div>
          {currentQuestions.map((q, i) => (
            <div key={i} className="space-y-1">
              <label className="text-sm font-medium">
                Q{i + 1}: {q}
              </label>
              <Textarea
                placeholder="Your answer..."
                value={answers[i] || ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                }
                rows={3}
                className="resize-y"
              />
            </div>
          ))}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setCompleted(true); onComplete(allResponses); }}>
              End Interview
            </Button>
            <Button size="sm" onClick={submitAnswers}>
              <Send className="h-3 w-3 mr-1" /> Submit Answers
            </Button>
          </div>
        </div>
      )}

      {completed && (
        <div className="flex items-center justify-between rounded-lg border p-4 bg-accent/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">
              Interview complete ({allResponses.length} responses captured)
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={resetInterview}>
            <RotateCcw className="h-3 w-3 mr-1" /> Restart
          </Button>
        </div>
      )}
    </div>
  );
}

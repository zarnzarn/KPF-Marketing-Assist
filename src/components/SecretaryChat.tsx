"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Send } from "lucide-react";
import { MOCK_TODAY, brandRules } from "@/data/mock";
import { AnswerBlocks } from "@/components/AnswerBlocks";
import { Badge, Card } from "@/components/ui";
import { answerQuestion, quickActions, suggestedQuestions, type SecretaryAnswer } from "@/lib/ai/secretary";
import { formatLongDate } from "@/lib/dates";
import type { MonthlyReport } from "@/lib/reports/types";

type ChatMessage = { id: number; role: "user"; text: string } | { id: number; role: "ai"; answer: SecretaryAnswer };

const seedQuestion = "What should I do first today?";

export function SecretaryChat({ reports = [] }: { reports?: MonthlyReport[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 1, role: "user", text: seedQuestion },
    { id: 2, role: "ai", answer: answerQuestion(seedQuestion, { reports }) },
  ]);
  const [draft, setDraft] = useState("");
  const [requested, setRequested] = useState<string[]>([]);
  const nextId = useRef(3);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Keep the newest answer in view when a question is asked.
  useEffect(() => {
    const log = logRef.current;
    if (log && messages.length > 2) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const lastAnswer = [...messages].reverse().find((m): m is Extract<ChatMessage, { role: "ai" }> => m.role === "ai")?.answer;

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    const userId = nextId.current++;
    const aiId = nextId.current++;
    setMessages((prev) => [...prev, { id: userId, role: "user", text }, { id: aiId, role: "ai", answer: answerQuestion(text, { reports }) }]);
    setDraft("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0 xl:col-span-2">
        <Card id="chat" title="Conversation" subtitle="Chat history (mock)">
          <div ref={logRef} className="relative max-h-[34rem] space-y-4 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Chat history" tabIndex={0}>
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-forest px-4 py-2.5 text-[15px] text-white">
                    <span className="sr-only">You: </span>
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-white p-4">
                  <p className="font-display mb-2 text-lg font-semibold text-forest">
                    <span className="sr-only">Secretary: </span>
                    {m.answer.title}
                  </p>
                  <AnswerBlocks blocks={m.answer.blocks} />
                </div>
              ),
            )}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Ask the AI Secretary
            </label>
            <input
              id={inputId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about tasks, follow-ups, campaigns, meetings…"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-[15px] placeholder:text-muted"
            />
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 font-semibold text-white hover:bg-sage">
              <Send className="h-4 w-4" aria-hidden="true" />
              Ask
            </button>
          </form>
        </Card>

        <Card id="quick" title="Quick actions" className="mt-6">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-forest/30 bg-forest-soft px-4 py-2 text-sm font-medium text-forest hover:bg-yolk-soft">
                {q}
              </button>
            ))}
          </div>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-muted">Suggested questions</h3>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-yolk">
                {q}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card id="context" title="Context" subtitle="What the secretary can see">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted">Source</dt><dd className="font-medium">{reports.some((r) => !r.isMock) ? "Mock data + your monthly reports" : "Mock data only"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Today (mock)</dt><dd className="font-medium">{formatLongDate(MOCK_TODAY)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Mode</dt><dd className="font-medium">Read &amp; draft only</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Monthly reports loaded</dt><dd className="font-medium">{reports.filter((r) => !r.isMock).length || "None (mock sample)"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Brand rules loaded</dt><dd className="font-medium">{brandRules.length}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-muted">If something is not in the mock data, the secretary says “Data not available.”</p>
        </Card>

        <Card id="sources" title="Source records" subtitle="Records behind the latest answer">
          {lastAnswer && lastAnswer.sources.length > 0 ? (
            <ul className="space-y-2">
              {lastAnswer.sources.map((s) => (
                <li key={`${s.kind}-${s.id}`}>
                  <Link href={s.href} className="flex items-start gap-2 text-sm hover:underline">
                    <Badge tone="neutral">{s.kind}</Badge>
                    <span>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No source records for this answer.</p>
          )}
        </Card>

        <Card id="action-preview" title="Action preview" subtitle="Drafts the secretary prepared. Nothing is sent.">
          {lastAnswer?.actionPreview ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">{lastAnswer.actionPreview.title}</p>
              <p className="text-muted">{lastAnswer.actionPreview.description}</p>
              {lastAnswer.actionPreview.draftText && (
                <blockquote className="rounded-lg border-l-4 border-yolk bg-yolk-soft p-3">{lastAnswer.actionPreview.draftText}</blockquote>
              )}
              <p>
                <Badge tone={lastAnswer.actionPreview.needsApproval ? "gold" : "green"}>
                  {lastAnswer.actionPreview.needsApproval ? "Approval required" : "No approval needed"}
                </Badge>
              </p>
              <button
                type="button"
                disabled={requested.includes(lastAnswer.actionPreview.title)}
                onClick={() => setRequested((r) => [...r, lastAnswer.actionPreview!.title])}
                className="rounded-lg bg-forest px-4 py-2 font-semibold text-white hover:bg-sage disabled:cursor-not-allowed disabled:bg-muted"
              >
                {requested.includes(lastAnswer.actionPreview.title) ? "Approval request created (mock)" : "Create approval request (mock)"}
              </button>
              <p role="status" className="text-muted">
                {requested.includes(lastAnswer.actionPreview.title) ? "Added to pending approvals (mock). Nothing was sent." : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">No action prepared. Try “Draft a LINE message for the weekend promotion”.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

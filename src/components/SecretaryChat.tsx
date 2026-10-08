"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Send } from "lucide-react";
import { brandRules } from "@/data/brand";
import { useAppData } from "@/components/AppDataProvider";
import { AnswerBlocks } from "@/components/AnswerBlocks";
import { Badge, Card } from "@/components/ui";
import { askSecretary } from "@/app/(app)/secretary/actions";
import { answerQuestion, quickActions, selectTool, suggestedQuestions, type SecretaryAnswer } from "@/lib/ai/secretary";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { formatLongDate } from "@/lib/dates";
import type { MonthlyReport } from "@/lib/reports/types";
import { addItem, newId } from "@/lib/store/userData";

type ChatMessage = { id: number; role: "user"; text: string } | { id: number; role: "ai"; answer: SecretaryAnswer } | { id: number; role: "thinking" };

export function SecretaryChat({ reports = [], channels = [], aiModel }: { reports?: MonthlyReport[]; channels?: ChannelSnapshot[]; aiModel?: string }) {
  const { data, update } = useAppData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [requested, setRequested] = useState<string[]>([]);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Keep the newest answer in view when a question is asked.
  useEffect(() => {
    const log = logRef.current;
    if (log && messages.length > 0) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const lastAnswer = [...messages].reverse().find((m): m is Extract<ChatMessage, { role: "ai" }> => m.role === "ai")?.answer;

  const [waiting, setWaiting] = useState(false);

  function ask(question: string) {
    const text = question.trim();
    if (!text || waiting) return;
    const userId = nextId.current++;
    const aiId = nextId.current++;
    setDraft("");
    // Known questions and quick actions: exact, instant answers from the rules. Anything else goes to the AI model if connected.
    if (!aiModel || selectTool(text) !== "unknown") {
      setMessages((prev) => [...prev, { id: userId, role: "user", text }, { id: aiId, role: "ai", answer: answerQuestion(text, { data, reports, channels }) }]);
      return;
    }
    setMessages((prev) => [...prev, { id: userId, role: "user", text }, { id: aiId, role: "thinking" }]);
    setWaiting(true);
    const { tasks, meetings, customers, campaigns, content, issues, approvals, documents } = data;
    askSecretary(text, { tasks, meetings, customers, campaigns, content, issues, approvals, documents }, data.today)
      .catch(() => {
        const answer = answerQuestion(text, { data, reports, channels });
        return { ...answer, blocks: [...answer.blocks, { label: "DATA GAP" as const, text: "AI answer: Data not available. (the app could not reach the server)" }] };
      })
      .then((answer) => setMessages((prev) => prev.map((m) => (m.id === aiId ? { id: aiId, role: "ai", answer } : m))))
      .finally(() => setWaiting(false));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0 xl:col-span-2">
        <Card id="chat" title="Conversation" subtitle="This conversation is not saved">
          <div ref={logRef} className="relative max-h-[34rem] space-y-4 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Chat history" tabIndex={0}>
            {messages.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line bg-white/60 p-4 text-[15px] text-muted">
                Ask a question below or pick a quick action. I answer only from your entries, your monthly reports and your connected channels, and I say &ldquo;Data not available.&rdquo; when I don&apos;t know.
              </p>
            )}
            {messages.map((m) =>
              m.role === "thinking" ? (
                <p key={m.id} role="status" className="max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-white p-4 text-[15px] text-muted">
                  Writing an answer from your data… (this can take up to a minute)
                </p>
              ) : m.role === "user" ? (
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
            <button type="submit" disabled={waiting} className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 font-semibold text-white hover:bg-sage disabled:opacity-70">
              <Send className="h-4 w-4" aria-hidden="true" />
              Ask
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            {aiModel
              ? `Free-text questions are answered by the AI model (${aiModel} on Ollama). Your question and the related entries, report text and channel numbers are sent to Ollama to write the answer. Nothing is sent anywhere else.`
              : "The AI model is not connected, so answers come from fixed rules. Add OLLAMA_API_KEY to connect it."}
          </p>
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
            <div className="flex justify-between gap-2"><dt className="text-muted">Source</dt><dd className="font-medium">Your entries, reports, channels</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Today</dt><dd className="font-medium">{formatLongDate(data.today)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Mode</dt><dd className="font-medium">Read &amp; draft only</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Monthly reports loaded</dt><dd className="font-medium">{reports.length || "None"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Channels connected</dt><dd className="font-medium">{channels.filter((c) => c.status === "connected").length || "None"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Brand rules loaded</dt><dd className="font-medium">{brandRules.length}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-muted">If something is not in your data, the secretary says “Data not available.”</p>
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
                onClick={() => {
                  const preview = lastAnswer.actionPreview!;
                  update((u) => addItem(u, "approvals", { id: newId("apr"), actionType: preview.actionType, title: preview.title, requestedAt: data.today, state: "Pending", relatedHref: "/content" }));
                  setRequested((r) => [...r, preview.title]);
                }}
                className="rounded-lg bg-forest px-4 py-2 font-semibold text-white hover:bg-sage disabled:cursor-not-allowed disabled:bg-muted"
              >
                {requested.includes(lastAnswer.actionPreview.title) ? "Approval request created" : "Create approval request"}
              </button>
              <p role="status" className="text-muted">
                {requested.includes(lastAnswer.actionPreview.title) ? "Added to pending approvals. Nothing was sent." : ""}
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

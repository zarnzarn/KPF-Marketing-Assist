"use server";

import { buildContext, parseLabelled, systemPrompt, userMessage } from "@/lib/ai/llmAnswer";
import { ollamaChat, ollamaSettings } from "@/lib/ai/ollama";
import { answerQuestion, type AnswerBlock, type SecretaryAnswer } from "@/lib/ai/secretary";
import { requireViewer } from "@/lib/auth/session";
import { explain } from "@/lib/channels/readOnlyFetch";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { viewerChannels, viewerReports } from "@/lib/data/server";
import { isIsoDate } from "@/lib/dates";
import { parseUserDataValue } from "@/lib/store/userData";
import { todayInThailand } from "@/lib/today";
import type { AppData, SourceRecord } from "@/lib/types";

const MAX_QUESTION = 1000;

/**
 * A free-text question to the AI Secretary. The answer is written by Ollama from the user's own data
 * only, then checked (labels, numbers). If Ollama is not set up or fails, the rule-based secretary
 * answers instead and says why. Nothing is sent anywhere except this one question to Ollama.
 */
export async function askSecretary(question: string, entries: unknown, today: string): Promise<SecretaryAnswer> {
  await requireViewer();
  const text = String(question ?? "").trim().slice(0, MAX_QUESTION);
  const [{ reports }, channels] = await Promise.all([viewerReports(), viewerChannels()]);
  const products = channels.find((c) => c.channel === "shop")?.products ?? [];
  const data: AppData = { ...parseUserDataValue(entries), today: isIsoDate(String(today)) ? String(today) : todayInThailand(), products };

  const fallback = (why: string): SecretaryAnswer => {
    const answer = answerQuestion(text, { data, reports, channels });
    return { ...answer, blocks: [...answer.blocks, { label: "DATA GAP", text: `AI answer: ${DATA_NOT_AVAILABLE} (${why})` }] };
  };
  if (!text) return fallback("empty question");
  if (!ollamaSettings()) return fallback("the AI model is not connected; add OLLAMA_API_KEY");

  const context = buildContext({ data, reports, channels });
  try {
    const reply = await ollamaChat([
      { role: "system", content: systemPrompt() },
      { role: "user", content: userMessage(text, context) },
    ]);
    const blocks: AnswerBlock[] = parseLabelled(reply, context);
    const sources: SourceRecord[] = [
      ...reports.slice(0, 2).map((r) => ({ kind: "Report" as const, id: r.id, label: r.title, href: r.month ? `/reports?month=${r.month}` : "/reports" })),
      ...channels.filter((c) => c.status === "connected").map((c) => ({ kind: "Channel" as const, id: c.channel, label: c.label, href: "/channels" })),
    ];
    return { tool: "ai", title: "AI Secretary (Ollama)", blocks, sources };
  } catch (error) {
    return fallback(explain(error));
  }
}

/** Channels page: checks that the Ollama key and model work, with a tiny question. */
export async function testOllama(): Promise<{ ok: boolean; message: string }> {
  await requireViewer();
  const settings = ollamaSettings();
  if (!settings) return { ok: false, message: "Not connected: add OLLAMA_API_KEY (and optionally OLLAMA_MODEL)." };
  try {
    await ollamaChat([{ role: "user", content: "Reply with the single word OK." }], { timeoutMs: 30_000 });
    return { ok: true, message: `Connected. Model: ${settings.model}.` };
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

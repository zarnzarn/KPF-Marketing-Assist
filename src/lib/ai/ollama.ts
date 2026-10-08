import "server-only";
// Ollama cloud (https://ollama.com), free plan model gemma4:cloud by default. Server only: the API key
// lives in OLLAMA_API_KEY (.env.local or your host's settings, such as Netlify) and never reaches the browser.
// The request goes through readOnlyFetch: fixed address, no redirects, time limit, key redacted from errors.
// The 25-second limit stays inside Netlify's function time limit; a slower answer falls back to the rule-based one.
import { ChannelError, readOnlyJson } from "../channels/readOnlyFetch";
import type { FetchLike } from "../channels/readOnlyFetch";

export const OLLAMA_CHAT_URL = "https://ollama.com/api/chat";
export const DEFAULT_OLLAMA_MODEL = "gemma4:cloud";

type Env = Record<string, string | undefined>;
const value = (env: Env, name: string) => (env[name] ?? "").trim().replace(/^["']|["']$/g, "");

export function ollamaSettings(env: Env = process.env): { apiKey: string; model: string } | null {
  const apiKey = value(env, "OLLAMA_API_KEY");
  return apiKey ? { apiKey, model: value(env, "OLLAMA_MODEL") || DEFAULT_OLLAMA_MODEL } : null;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Sends one conversation and returns the model's text. Throws ChannelError with a plain message on failure. */
export async function ollamaChat(messages: ChatMessage[], { env = process.env, fetchImpl, timeoutMs = 25_000 }: { env?: Env; fetchImpl?: FetchLike; timeoutMs?: number } = {}): Promise<string> {
  const settings = ollamaSettings(env);
  if (!settings) throw new ChannelError("OLLAMA_API_KEY is not set.", "auth");
  const res = await readOnlyJson<{ message?: { content?: unknown } }>(OLLAMA_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: settings.model, messages, stream: false, options: { temperature: 0.2 } }),
    secrets: [settings.apiKey],
    timeoutMs,
    fetchImpl,
  });
  const content = res.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new ChannelError("Ollama sent an empty answer.", "bad_response");
  return content;
}

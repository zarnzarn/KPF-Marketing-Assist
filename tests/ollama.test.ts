// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_OLLAMA_MODEL, OLLAMA_CHAT_URL, ollamaChat, ollamaSettings } from "@/lib/ai/ollama";
import { ChannelError, explain, type FetchLike } from "@/lib/channels/readOnlyFetch";

const KEY = "test-ollama-key-1234567890";
const ENV = { OLLAMA_API_KEY: KEY };

function fake(reply: Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return reply;
  };
  return { calls, fetchImpl };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Ollama settings", () => {
  it("needs a key and uses gemma4:cloud unless another model is set", () => {
    expect(ollamaSettings({})).toBeNull();
    expect(ollamaSettings(ENV)).toEqual({ apiKey: KEY, model: DEFAULT_OLLAMA_MODEL });
    expect(ollamaSettings({ ...ENV, OLLAMA_MODEL: " 'gpt-oss:20b' " })?.model).toBe("gpt-oss:20b");
  });
});

describe("ollamaChat", () => {
  it("sends one POST to ollama.com with the key only in the header and no redirects", async () => {
    const { calls, fetchImpl } = fake(json({ message: { role: "assistant", content: "FACT: ok" } }));
    await expect(ollamaChat([{ role: "user", content: "Hi" }], { env: ENV, fetchImpl })).resolves.toBe("FACT: ok");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(OLLAMA_CHAT_URL);
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.redirect).toBe("manual");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toMatchObject({ model: DEFAULT_OLLAMA_MODEL, stream: false, messages: [{ role: "user", content: "Hi" }] });
    expect(String(calls[0].init?.body)).not.toContain(KEY);
  });

  it("does not call anything without a key", async () => {
    const { calls, fetchImpl } = fake(json({}));
    await expect(ollamaChat([{ role: "user", content: "Hi" }], { env: {}, fetchImpl })).rejects.toBeInstanceOf(ChannelError);
    expect(calls).toHaveLength(0);
  });

  it("explains a refused key with Ollama's own short error, and never shows the key", async () => {
    const { fetchImpl } = fake(json({ error: `unauthorized: ${KEY}` }, 401));
    const error = await ollamaChat([{ role: "user", content: "Hi" }], { env: ENV, fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.kind).toBe("auth");
    expect(error.message).toContain("unauthorized");
    expect(explain(error)).not.toContain(KEY);
  });

  it("treats an empty answer as an error, not as an answer", async () => {
    const { fetchImpl } = fake(json({ message: { content: "  " } }));
    await expect(ollamaChat([{ role: "user", content: "Hi" }], { env: ENV, fetchImpl })).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("stops when ollama.com answers with a redirect", async () => {
    const { fetchImpl } = fake(new Response(null, { status: 307, headers: { Location: "https://evil.example.com/" } }));
    await expect(ollamaChat([{ role: "user", content: "Hi" }], { env: ENV, fetchImpl })).rejects.toMatchObject({ kind: "blocked" });
  });
});

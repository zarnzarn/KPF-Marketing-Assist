import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Safety net for the "Real data rules" in AGENTS.md: real report files, local
// settings and channel credentials must never be committed.
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const textFiles = tracked.filter((f) => /\.(ts|tsx|js|mjs|cjs|json|md|css|ya?ml|txt|example|env|sql)$/i.test(f) || !f.includes("."));

// Patterns for real-looking secrets. Test files use obviously fake values such as "test-token-…".
const SECRET_PATTERNS: [string, RegExp][] = [
  ["Meta access token", /\bEAA[A-Za-z0-9]{40,}/],
  ["Shopify access token", /\bshp(at|ca|pa|ss)_[a-f0-9]{32}\b/],
  ["WooCommerce key", /\b(ck|cs)_[a-f0-9]{40}\b/],
  ["private key", /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["long bearer token", /Bearer\s+[A-Za-z0-9._~+/=-]{80,}/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}/],
  ["JSON web token (e.g. a Supabase service-role key)", /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ["filled-in secret setting", /^\s*(OLLAMA_API_KEY|META_PAGE_ACCESS_TOKEN|LINE_CHANNEL_ACCESS_TOKEN|SHOP_API_KEY|SHOP_API_SECRET|GA4_SERVICE_ACCOUNT_JSON)=(?!\.\.\.)\S+/m],
];

describe("real data and secrets are never tracked by git", () => {
  it("has no Word documents in the repository", () => {
    expect(tracked.filter((f) => /\.docx$/i.test(f))).toEqual([]);
  });

  it("has nothing from the private folders", () => {
    expect(tracked.filter((f) => f.startsWith("data/private") || f.startsWith("private/"))).toEqual([]);
  });

  it("has no local env files or key files tracked", () => {
    expect(tracked.filter((f) => /(^|\/)\.env(\..*)?$/.test(f) && !f.endsWith(".env.example"))).toEqual([]);
    expect(tracked.filter((f) => /\.pem$|service-account.*\.json$|-key\.json$/i.test(f))).toEqual([]);
  });

  it("git-ignores the private folders, Word files, local env files and key files", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    for (const line of ["/data/private/", "/private/", "*.docx", ".env*", "*.pem", "*service-account*.json", "*-key.json"]) {
      expect(ignore.split(/\r?\n/)).toContain(line);
    }
  });

  it.each(SECRET_PATTERNS)("contains no %s in any tracked text file", (_name, pattern) => {
    const hits = textFiles.filter((f) => {
      try {
        return pattern.test(readFileSync(f, "utf8"));
      } catch {
        return false;
      }
    });
    expect(hits).toEqual([]);
  });
});

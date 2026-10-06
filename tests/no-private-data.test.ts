import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Safety net for the "Real data exception" in AGENTS.md: real report files must
// never be committed.
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);

describe("real data is never tracked by git", () => {
  it("has no Word documents in the repository", () => {
    expect(tracked.filter((f) => /\.docx$/i.test(f))).toEqual([]);
  });
  it("has nothing from the private folders", () => {
    expect(tracked.filter((f) => f.startsWith("data/private") || f.startsWith("private/"))).toEqual([]);
  });
  it("has no .env.local files tracked", () => {
    expect(tracked.filter((f) => /^\.env(\..*)?\.local$/.test(f))).toEqual([]);
  });
  it("git-ignores the private folder, Word files and local env files", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toMatch(/^\/data\/private\/$/m);
    expect(ignore).toMatch(/^\/private\/$/m);
    expect(ignore).toMatch(/^\*\.docx$/m);
    expect(ignore).toMatch(/^\.env\*$/m);
  });
});

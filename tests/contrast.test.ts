import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the real palette from globals.css so the test cannot drift from the design.
const css = readFileSync("src/app/globals.css", "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const white = "#ffffff";
const pairs: [string, string, string][] = [
  ["body text", token("ink"), token("paper")],
  ["body text on cards", token("ink"), token("card")],
  ["muted text on paper", token("muted"), token("paper")],
  ["muted text on cards", token("muted"), token("card")],
  ["muted text on white", token("muted"), white],
  ["white on forest (sidebar, buttons)", white, token("forest")],
  ["forest headings on paper", token("forest"), token("paper")],
  ["forest on yolk (active nav)", token("forest"), token("yolk")],
  ["forest on forest-soft (badges, table head)", token("forest"), token("forest-soft")],
  ["clay on clay-soft (badges)", token("clay"), token("clay-soft")],
  ["clay on cards (overdue text)", token("clay"), token("card")],
  ["sage links on cards", token("sage"), token("card")],
  ["white on sage (hover buttons)", white, token("sage")],
  ["badge gold text on yolk-soft", "#6b4a05", token("yolk-soft")],
  ["banner text on yolk-soft", "#5b4004", token("yolk-soft")],
  ["yolk on forest (sidebar subtitle)", token("yolk"), token("forest")],
];

describe("WCAG AA contrast (4.5:1 for normal text)", () => {
  it.each(pairs)("%s", (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

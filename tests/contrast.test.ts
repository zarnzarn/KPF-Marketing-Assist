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

const ivory = "#fdfbf5"; // the app's "white" (never pure white)
const pairs: [string, string, string][] = [
  ["body text on paper", token("ink"), token("paper")],
  ["body text on cards", token("ink"), token("card")],
  ["body text on sidebar", token("ink"), token("sidebar")],
  ["muted text on paper", token("muted"), token("paper")],
  ["muted text on cards", token("muted"), token("card")],
  ["muted text on pastel sage", token("muted"), token("forest-soft")],
  ["muted text on pastel butter", token("muted"), token("yolk-soft")],
  ["muted text on pastel blush", token("muted"), token("clay-soft")],
  ["muted text on pastel sky", token("muted"), token("sky-soft")],
  ["ivory on forest (buttons)", ivory, token("forest")],
  ["ivory on sage (button hover)", ivory, token("sage")],
  ["forest headings on paper", token("forest"), token("paper")],
  ["forest on pastel butter (active nav, hero)", token("forest"), token("yolk-soft")],
  ["forest on pastel sage (badges, table head)", token("forest"), token("forest-soft")],
  ["forest on pastel sky", token("forest"), token("sky-soft")],
  ["forest on pastel blush", token("forest"), token("clay-soft")],
  ["clay on pastel blush (badges)", token("clay"), token("clay-soft")],
  ["clay on cards (overdue text)", token("clay"), token("card")],
  ["clay on pastel sage", token("clay"), token("forest-soft")],
  ["sage links on cards", token("sage"), token("card")],
  ["sage eyebrow text on paper", token("sage"), token("paper")],
  ["sky-ink on pastel sky (ANALYSIS tag)", token("sky-ink"), token("sky-soft")],
  ["badge gold text on pastel butter", "#6b4a05", token("yolk-soft")],
  ["banner text on butter", "#5b4004", token("yolk-soft")],
];

describe("WCAG AA contrast (4.5:1 for normal text)", () => {
  it.each(pairs)("%s", (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

// Turns a monthly marketing report (.docx) into structured data.
// Business logic only: no UI code, no file-system access (see loadReports.ts).

import mammoth from "mammoth";
import { parse, type HTMLElement } from "node-html-parser";
import type { KpiTile, MonthlyReport, ReportBlock, ReportSection } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const clean = (text: string) => text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const BULLET = /^[•▪▫·●○◦‣-]\s*/;
const HEADING = /^(\d{1,2})\s*[.)]?\s+(\S.*)$/;

export class ReportParseError extends Error {}

/** "฿1,234" / "THB 123K" / "1.2M" -> number, or null when it is not a number. */
export function parseThb(text: string): number | null {
  const match = clean(text).replace(/[฿,]|THB/gi, "").trim().match(/^(-?\d+(?:\.\d+)?)\s*([KkMm])?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const factor = match[2] ? (match[2].toLowerCase() === "k" ? 1_000 : 1_000_000) : 1;
  return value * factor;
}

/** Reads the first "1-30 September 2026" style date range and returns "2026-09". */
export function monthFromTitle(text: string): string {
  const names = MONTHS.join("|");
  const match = clean(text).match(new RegExp(`\\d{1,2}\\s*[-–]\\s*\\d{1,2}\\s+(${names})\\s+(\\d{4})`, "i"));
  if (!match) return "";
  const index = MONTHS.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  return `${match[2]}-${String(index + 1).padStart(2, "0")}`;
}

const SHORT_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Reads "Mar - 2026", "March 2026" or "Sep-2026" (a folder or file name) and returns "2026-03". */
export function monthFromText(text: string): string {
  const match = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s_-]*(\d{4})\b/i);
  if (!match) return "";
  return `${match[2]}-${String(SHORT_MONTHS.indexOf(match[1].toLowerCase()) + 1).padStart(2, "0")}`;
}

function cellParagraphs(cell: HTMLElement): string[] {
  const paragraphs = cell.querySelectorAll("p").map((p) => clean(p.text)).filter(Boolean);
  if (paragraphs.length > 0) return paragraphs;
  const text = clean(cell.text);
  return text ? [text] : [];
}

function tableToBlock(table: HTMLElement): ReportBlock | null {
  const rows = table.querySelectorAll("tr");
  if (rows.length === 0) return null;

  // A one-row table is either a row of KPI tiles or a boxed callout.
  if (rows.length === 1) {
    const cells = rows[0].querySelectorAll("td, th").map(cellParagraphs).filter((c) => c.length > 0);
    if (cells.length === 0) return null;
    const looksLikeTiles = cells.length >= 2 && cells.every((c) => c.length >= 2 && c.length <= 4 && c.every((line) => line.length <= 60));
    if (looksLikeTiles) {
      const items: KpiTile[] = cells.map(([label, value, ...note]) => ({ label, value, note: note.length ? note.join(" ") : undefined }));
      return { type: "kpis", items };
    }
    return { type: "callout", paragraphs: cells.flat().map((line) => line.replace(BULLET, "")) };
  }

  const grid = rows.map((row) => row.querySelectorAll("td, th").map((cell) => clean(cell.text)));
  const width = Math.max(...grid.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const [headers, ...body] = grid.map(pad);
  return { type: "table", headers, rows: body };
}

/** Parses one .docx file. Throws ReportParseError if the file is not a readable Word document. */
export async function parseReport(buffer: Buffer, fileName: string): Promise<MonthlyReport> {
  let html: string;
  try {
    const result = await mammoth.convertToHtml(
      { buffer },
      { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) }, // charts are not used
    );
    html = result.value;
  } catch {
    throw new ReportParseError(`"${fileName}" could not be read as a Word (.docx) file.`);
  }

  const root = parse(`<div>${html}</div>`).firstChild as HTMLElement;
  const intro: ReportBlock[] = [];
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;
  let bullets: string[] = [];
  const titleParts: string[] = [];

  const push = (block: ReportBlock) => (current ? current.blocks.push(block) : intro.push(block));
  const flushBullets = () => {
    if (bullets.length > 0) push({ type: "bullets", items: bullets });
    bullets = [];
  };

  for (const node of root.childNodes) {
    if (!("tagName" in node)) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "table") {
      flushBullets();
      const block = tableToBlock(el);
      if (block) push(block);
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      flushBullets();
      const items = el.querySelectorAll("li").map((li) => clean(li.text)).filter(Boolean);
      if (items.length > 0) push({ type: "bullets", items });
      continue;
    }

    const text = clean(el.text);
    if (!text) continue; // empty paragraph or a paragraph that only held a picture

    if (BULLET.test(text)) {
      bullets.push(text.replace(BULLET, ""));
      continue;
    }
    flushBullets();

    // A heading is a short numbered line that is entirely bold (or a real Word heading).
    const boldText = clean(el.querySelectorAll("strong").map((s) => s.text).join(""));
    const isHeadingTag = /^h[1-6]$/.test(tag);
    const match = text.match(HEADING);
    if (match && text.length <= 60 && (isHeadingTag || boldText === text)) {
      current = { number: Number(match[1]), title: clean(match[2]), blocks: [] };
      sections.push(current);
      continue;
    }

    if (!current && titleParts.length < 3 && text.length <= 120) titleParts.push(text);
    push({ type: "paragraph", text });
  }
  flushBullets();

  // The title lines are shown as the heading, so do not repeat them in the intro.
  const isTitleLine = (text: string) => titleParts.includes(text) && /report|klong phai farm|\d{4}/i.test(text);
  const introBlocks = intro.filter((b) => !(b.type === "paragraph" && isTitleLine(b.text)));

  if (sections.length === 0 && introBlocks.length === 0) {
    throw new ReportParseError(`"${fileName}" has no readable text.`);
  }

  const fullTitle = titleParts.filter((t) => /report/i.test(t) || /\d{4}/.test(t)).join(" ") || titleParts.join(" ") || fileName;
  const month = monthFromTitle(titleParts.join(" ")) || monthFromTitle(fileName);
  const baseName = fileName.replace(/\.docx$/i, "");
  return {
    id: month || baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: clean(fullTitle),
    month,
    intro: introBlocks,
    sections,
  };
}

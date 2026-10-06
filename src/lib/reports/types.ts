// Shapes for monthly marketing reports read from Word (.docx) files.

export interface KpiTile {
  label: string;
  value: string;
  note?: string;
}

export type ReportBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "kpis"; items: KpiTile[] }
  | { type: "callout"; paragraphs: string[] };

export interface ReportSection {
  number: number | null;
  title: string;
  blocks: ReportBlock[];
}

export interface MonthlyReport {
  id: string;
  title: string;
  /** YYYY-MM, or "" when the month could not be read from the title. */
  month: string;
  /** Mock sample reports are flagged so the UI can label them. */
  isMock: boolean;
  /** Blocks that come before the first numbered section (title area, KPI tiles). */
  intro: ReportBlock[];
  sections: ReportSection[];
}

export interface ReportLoadResult {
  source: "local" | "mock";
  reports: MonthlyReport[];
  /** Human-readable problems, e.g. a file that could not be read. */
  warnings: string[];
  /** Harmless information, e.g. other Word files that were skipped. */
  notes: string[];
}

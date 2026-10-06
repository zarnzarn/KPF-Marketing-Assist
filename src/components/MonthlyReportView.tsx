import { Badge, Card, DataTable, Stat, type Column } from "@/components/ui";
import type { MonthlyReport, ReportBlock } from "@/lib/reports/types";

const accents = ["sage", "butter", "sky", "blush"] as const;

/** "+15.2%" in green, "-24.0%" in clay, with arrows and screen-reader text. */
function ChangeCell({ text }: { text: string }) {
  const trimmed = text.trim();
  const up = trimmed.startsWith("+");
  const down = /^[-−–]/.test(trimmed);
  if (!up && !down) return <>{text}</>;
  return (
    <span className={up ? "font-semibold text-sage" : "font-semibold text-clay"}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {trimmed.replace(/^[+\-−–]\s*/, "")}
      <span className="sr-only">{up ? " increase" : " decrease"}</span>
    </span>
  );
}

function isTotalRow(row: string[]) {
  return /^(grand total|total)\b/i.test(row[0] ?? "");
}

function TableBlock({ block, caption }: { block: Extract<ReportBlock, { type: "table" }>; caption: string }) {
  const columns: Column<string[]>[] = block.headers.map((header, index) => {
    const isChange = /change|diff|vs\b/i.test(header);
    const isNumberColumn = index > 0 && !isChange;
    return {
      header: header || `Column ${index + 1}`,
      className: isNumberColumn ? "text-right tabular-nums" : undefined,
      cell: (row) => {
        const value = row[index] ?? "";
        if (index === 0) return <span className={isTotalRow(row) ? "font-bold" : "font-medium"}>{value}</span>;
        if (isChange) return <ChangeCell text={value} />;
        return <span className={isTotalRow(row) ? "font-bold" : undefined}>{value}</span>;
      },
    };
  });
  return <DataTable caption={caption} columns={columns} rows={block.rows} rowKey={(row) => row.join("|")} />;
}

function Block({ block, caption }: { block: ReportBlock; caption: string }) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-[15px] leading-relaxed text-muted">{block.text}</p>;
    case "bullets":
      return (
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed marker:text-sage">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return <TableBlock block={block} caption={caption} />;
    case "kpis":
      return (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {block.items.map((item, i) => (
            <Stat key={item.label} accent={accents[i % accents.length]} label={item.label} value={item.value} note={item.note} tone="flat" />
          ))}
        </div>
      );
    case "callout":
      return (
        <ul className="space-y-2 rounded-2xl bg-white/70 p-4 text-[15px] leading-relaxed ring-1 ring-line">
          {block.paragraphs.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      );
  }
}

/** Renders one monthly report faithfully: KPI tiles, narrative bullets and every table. */
export function MonthlyReportView({ report }: { report: MonthlyReport }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-forest">{report.title}</h2>
        <Badge tone={report.isMock ? "gold" : "green"}>{report.isMock ? "MOCK sample" : "Real report (local file)"}</Badge>
      </div>

      {report.intro.length > 0 && (
        <div className="space-y-4">
          {report.intro.map((block, i) => (
            <Block key={i} block={block} caption={`${report.title} summary`} />
          ))}
        </div>
      )}

      {report.sections.map((section) => (
        <Card key={`${section.number}-${section.title}`} id={`section-${section.number ?? section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} title={`${section.number ? `${section.number}. ` : ""}${section.title}`} tone={/bottom line|key observation/i.test(section.title) ? "butter" : undefined}>
          <div className="space-y-4">
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} caption={section.title} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

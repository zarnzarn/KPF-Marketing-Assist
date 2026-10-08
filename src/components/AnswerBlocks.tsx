import type { AnswerBlock, AnswerLabel } from "@/lib/ai/secretary";

const labelStyle: Record<AnswerLabel, string> = {
  FACT: "bg-forest-soft text-forest border-forest/30",
  ANALYSIS: "bg-sky-soft text-sky-ink border-sky-ink/25",
  ESTIMATE: "bg-yolk-soft text-[#6b4a05] border-yolk/50",
  RECOMMENDATION: "bg-forest text-white border-forest",
  "DATA GAP": "bg-clay-soft text-clay border-clay/40",
};

export function LabelTag({ label }: { label: AnswerLabel }) {
  return (
    <span
      className={`mt-0.5 inline-block w-32 shrink-0 self-start rounded-md border px-2 py-0.5 text-center text-[10px] font-bold tracking-wide ${
        labelStyle[label]
      }`}
    >
      {label}
    </span>
  );
}

/** Renders labelled statements so FACT / ANALYSIS / ESTIMATE / RECOMMENDATION / DATA GAP are always visible. */
export function AnswerBlocks({ blocks }: { blocks: AnswerBlock[] }) {
  return (
    <ul className="space-y-2.5">
      {blocks.map((b, i) => (
        <li key={i} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <LabelTag label={b.label} />
          <p className="text-[15px] leading-relaxed">{b.text}</p>
        </li>
      ))}
    </ul>
  );
}

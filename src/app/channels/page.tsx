import { ExternalLink } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { loadChannels } from "@/lib/channels/loadChannels";
import { setupSteps } from "@/lib/channels/setupSteps";
import type { ChannelSnapshot } from "@/lib/channels/types";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Channels · Klong Phai Farm" };
export const dynamic = "force-dynamic";

const statusLabel: Record<ChannelSnapshot["status"], { text: string; tone: "green" | "neutral" | "clay" }> = {
  connected: { text: "Connected (read-only)", tone: "green" },
  not_configured: { text: "Not connected", tone: "neutral" },
  error: { text: "Problem", tone: "clay" },
};

function readAt(iso?: string) {
  if (!iso) return null;
  const thai = new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString();
  return `${formatDate(thai.slice(0, 10))} ${thai.slice(11, 16)} (Thailand time)`;
}

export default async function ChannelsPage() {
  const channels = await loadChannels();
  const connected = channels.filter((c) => c.status === "connected").length;

  return (
    <>
      <PageHeader title="Channels" subtitle="Read-only connections to your own website, Google Analytics, shop, Facebook, Instagram and LINE OA. Nothing is ever posted, sent or changed." />

      <p className="mb-6 rounded-2xl bg-sky-soft/70 p-4 text-sm text-sky-ink ring-1 ring-sky-ink/20">
        {connected} of {channels.length} channels connected. Settings live in <code className="font-semibold">.env.local</code> on your computer (never committed to GitHub). After changing it, restart the app. Numbers are refreshed at most every 15 minutes.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {channels.map((c) => {
          const s = statusLabel[c.status];
          const help = setupSteps[c.channel];
          return (
            <Card key={c.channel} id={`channel-${c.channel}`} title={c.label} subtitle={help.summary}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={s.tone}>{s.text}</Badge>
                {readAt(c.fetchedAt) && <span className="text-xs text-muted">Read {readAt(c.fetchedAt)}</span>}
              </div>

              {c.message && <p className={`mb-3 text-sm ${c.status === "error" ? "font-medium text-clay" : "text-muted"}`}>{c.message}</p>}

              {c.status === "connected" && (
                <>
                  {c.metrics.length > 0 ? (
                    <dl className="mb-4 grid grid-cols-2 gap-3">
                      {c.metrics.map((m) => (
                        <div key={m.label} className="rounded-xl bg-white/80 p-3 ring-1 ring-line">
                          <dt className="text-xs text-muted">{m.label}</dt>
                          <dd className="font-display text-xl font-semibold break-words text-forest">{m.value}</dd>
                          {m.note && <dd className="text-xs text-muted">{m.note}</dd>}
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <EmptyState />
                  )}
                  {c.items.length > 0 && (
                    <ul className="divide-y divide-line text-sm">
                      {c.items.map((item) => (
                        <li key={item.id} className="py-2">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-forest underline-offset-4 hover:underline">
                              <span className="break-all">{item.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                          ) : (
                            <span className="font-medium">{item.title}</span>
                          )}
                          {(item.date || item.detail) && <span className="block text-xs text-muted">{[item.date ? formatDate(item.date) : "", item.detail ?? ""].filter(Boolean).join(" · ")}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <details className="mt-4 rounded-xl bg-white/60 p-3 ring-1 ring-line">
                <summary className="cursor-pointer text-sm font-semibold text-sage">How to connect</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {help.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-muted">Lines to add to .env.local:</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-forest-soft p-2 text-xs text-forest">{help.env.join("\n")}</pre>
              </details>
            </Card>
          );
        })}
      </div>
    </>
  );
}

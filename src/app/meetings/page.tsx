import { MOCK_TODAY } from "@/data/mock";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { upcomingMeetings } from "@/lib/queries";

export const metadata = { title: "Meetings · Klong Phai Farm (Prototype)" };

export default function MeetingsPage() {
  const meetings = upcomingMeetings();
  return (
    <>
      <PageHeader title="Meetings" subtitle="Upcoming meetings with agenda, previous discussion and action items." />
      {meetings.length === 0 && <EmptyState>No upcoming meetings.</EmptyState>}
      <div className="space-y-6">
        {meetings.map((m) => (
          <Card key={m.id} id={m.id} title={m.title} subtitle={`${formatLongDate(m.date)} · ${m.start}–${m.end} · ${m.location}`}>
            {m.date === MOCK_TODAY && <p className="mb-3"><Badge tone="gold">Today</Badge></p>}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Participants</h3>
                <ul className="mb-4 list-disc pl-5 text-[15px]">{m.participants.map((p) => <li key={p}>{p}</li>)}</ul>
                <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Agenda</h3>
                <ol className="list-decimal pl-5 text-[15px]">{m.agenda.map((a) => <li key={a}>{a}</li>)}</ol>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Notes</h3>
                <p className="mb-4 text-[15px]">{m.notes}</p>
                <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Previous discussion</h3>
                <p className="text-[15px]">{m.previousDiscussion}</p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Action items</h3>
                {m.actionItems.length === 0 ? <EmptyState>No action items recorded.</EmptyState> : (
                  <ul className="space-y-1.5 text-[15px]">
                    {m.actionItems.map((a) => (
                      <li key={a.text} className="flex items-start gap-2">
                        <Badge>{a.done ? "Done" : "Open"}</Badge>
                        <span>{a.text} <span className="text-sm text-muted">({a.owner}, due {a.due})</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Follow-ups</h3>
                {m.followUps.length === 0 ? <EmptyState>No follow-ups recorded.</EmptyState> : <ul className="list-disc pl-5 text-[15px]">{m.followUps.map((f) => <li key={f}>{f}</li>)}</ul>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

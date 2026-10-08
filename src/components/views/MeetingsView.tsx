"use client";

import { useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { AddButton, DeleteButton, EntityForm, StatusMessage } from "@/components/EntityForm";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { meetingFields, toMeeting, validateRange } from "@/lib/forms";
import { upcomingMeetings } from "@/lib/queries";
import { addItem, newId, removeItem } from "@/lib/store/userData";

const H = ({ children }: { children: string }) => <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">{children}</h3>;

export function MeetingsView() {
  const { data, update } = useAppData();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const upcoming = upcomingMeetings(data);
  const past = data.meetings.filter((m) => m.date < data.today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AddButton label="Add meeting" onClick={() => setAdding(true)} />
        <StatusMessage text={message} />
      </div>

      {adding && (
        <EntityForm
          title="Add meeting"
          fields={meetingFields}
          defaults={{ date: data.today, start: "09:00", end: "10:00" }}
          submitLabel="Save meeting"
          extraValidate={(v) => validateRange(v, "start", "end", "End time must be after the start time.", true)}
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            update((u) => addItem(u, "meetings", toMeeting(newId("mtg"), v)));
            setAdding(false);
            setMessage("Meeting added.");
          }}
        />
      )}

      {upcoming.length === 0 && <EmptyState>No upcoming meetings. Use &ldquo;Add meeting&rdquo; to record one with its agenda and notes.</EmptyState>}

      {upcoming.map((m) => (
        <Card key={m.id} id={m.id} title={m.title} subtitle={`${formatLongDate(m.date)} · ${m.start}-${m.end}${m.location ? ` · ${m.location}` : ""}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {m.date === data.today ? <Badge tone="gold">Today</Badge> : <span />}
            <DeleteButton
              label={m.title}
              onClick={() => {
                update((u) => removeItem(u, "meetings", m.id));
                setMessage("Meeting deleted.");
              }}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <H>Participants</H>
              {m.participants.length ? <ul className="mb-4 list-disc pl-5 text-[15px]">{m.participants.map((p, i) => <li key={`${i}-${p}`}>{p}</li>)}</ul> : <p className="mb-4 text-sm text-muted">Data not available.</p>}
              <H>Agenda</H>
              {m.agenda.length ? <ol className="list-decimal pl-5 text-[15px]">{m.agenda.map((a, i) => <li key={`${i}-${a}`}>{a}</li>)}</ol> : <p className="text-sm text-muted">Data not available.</p>}
            </div>
            <div>
              <H>Notes</H>
              <p className="mb-4 text-[15px]">{m.notes || "Data not available."}</p>
              <H>Previous discussion</H>
              <p className="text-[15px]">{m.previousDiscussion || "Data not available."}</p>
            </div>
          </div>
        </Card>
      ))}

      {past.length > 0 && (
        <Card id="past" title="Past meetings">
          <ul className="divide-y divide-line">
            {past.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="block font-medium">{m.title}</span>
                  <span className="text-sm text-muted">{formatLongDate(m.date)}</span>
                </span>
                <DeleteButton
                  label={m.title}
                  onClick={() => {
                    update((u) => removeItem(u, "meetings", m.id));
                    setMessage("Meeting deleted.");
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

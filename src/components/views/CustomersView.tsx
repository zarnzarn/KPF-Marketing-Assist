"use client";

import { useId, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { CustomerTable } from "@/components/CustomerTable";
import { AddButton, EntityForm, StatusMessage } from "@/components/EntityForm";
import { Badge, Card, EmptyState, List, ListItem, Stat } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { customerFields, issueFields, toCustomer, toIssue } from "@/lib/forms";
import { followUpsDue, getCustomer, openIssues, upcomingFollowUps } from "@/lib/queries";
import { addItem, newId, removeItem, updateItem } from "@/lib/store/userData";

const types = [
  ["Hotels", "Hotel"],
  ["Restaurants", "Restaurant"],
  ["Chefs", "Chef"],
  ["Wholesale", "Wholesale"],
  ["Retail partners", "Retail Partner"],
  ["Corporate", "Corporate"],
] as const;
const accents = ["sage", "butter", "sky", "blush"] as const;

export function CustomersView() {
  const { data, update } = useAppData();
  const [form, setForm] = useState<"customer" | "issue" | null>(null);
  const [issueCustomer, setIssueCustomer] = useState("");
  const [message, setMessage] = useState("");
  const selectId = useId();
  const issues = openIssues(data.issues);
  const followUps = [...followUpsDue(data), ...upcomingFollowUps(data)];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AddButton label="Add customer or B2B account" onClick={() => setForm("customer")} />
        <AddButton
          label="Record a customer issue"
          onClick={() => {
            setIssueCustomer("");
            setForm("issue");
          }}
        />
        <StatusMessage text={message} />
      </div>

      {form === "customer" && (
        <EntityForm
          title="Add customer or B2B account"
          fields={customerFields}
          submitLabel="Save customer"
          onCancel={() => setForm(null)}
          onSubmit={(v) => {
            update((u) => addItem(u, "customers", toCustomer(newId("cus"), v)));
            setForm(null);
            setMessage("Customer added.");
          }}
        />
      )}

      {form === "issue" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-line">
            <label htmlFor={selectId} className="mb-1 block text-sm font-medium">Customer (optional)</label>
            <select id={selectId} value={issueCustomer} onChange={(e) => setIssueCustomer(e.target.value)} className="w-full max-w-md rounded-lg border border-line bg-white px-3 py-2 text-sm">
              <option value="">None</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <EntityForm
            title="Record a customer issue"
            fields={issueFields}
            defaults={{ openedAt: data.today, severity: "Medium" }}
            submitLabel="Save issue"
            onCancel={() => {
              setForm(null);
              setIssueCustomer("");
            }}
            onSubmit={(v) => {
              update((u) => addItem(u, "issues", toIssue(newId("iss"), v, issueCustomer)));
              setForm(null);
              setIssueCustomer("");
              setMessage("Issue recorded.");
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {types.map(([label, type], i) => (
          <Stat key={type} accent={accents[i % 4]} label={label} value={String(data.customers.filter((c) => c.type === type).length)} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="follow-ups" title="Follow-ups" subtitle="Due today or earlier, then the next 7 days">
          {followUps.length === 0 ? (
            <EmptyState>No follow-ups. Add a follow-up date to a customer to see it here.</EmptyState>
          ) : (
            <List>
              {followUps.map((c) => (
                <ListItem key={c.id}>
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="text-sm text-muted">Follow up {formatDate(c.followUpDate as string)}</span>
                  </span>
                  <Badge>{c.opportunity}</Badge>
                </ListItem>
              ))}
            </List>
          )}
        </Card>
        <Card id="issues" title="Open customer issues">
          {issues.length === 0 ? (
            <EmptyState>No open customer issues.</EmptyState>
          ) : (
            <List>
              {issues.map((i) => (
                <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <span>
                    <span className="block font-medium">{i.title}</span>
                    <span className="text-sm text-muted">{getCustomer(data, i.customerId)?.name ?? "No customer linked"} · opened {formatDate(i.openedAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge>{i.severity}</Badge>
                    <button
                      type="button"
                      onClick={() => {
                        update((u) => updateItem(u, "issues", i.id, { status: "Resolved" }));
                        setMessage("Issue marked as resolved.");
                      }}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-yolk"
                    >
                      Mark resolved<span className="sr-only"> {i.title}</span>
                    </button>
                  </span>
                </li>
              ))}
            </List>
          )}
        </Card>
      </div>

      <Card id="accounts" title="Customer list and B2B accounts" subtitle="Business names only. Personal phone numbers and emails are not stored.">
        {data.customers.length === 0 ? (
          <EmptyState>No customers yet. Use &ldquo;Add customer or B2B account&rdquo;. Saved in this browser only.</EmptyState>
        ) : (
          <CustomerTable
            customers={data.customers}
            onDelete={(c) => {
              update((u) => removeItem(u, "customers", c.id));
              setMessage("Customer deleted.");
            }}
          />
        )}
      </Card>
    </div>
  );
}

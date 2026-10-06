"use client";

import { useId, useState } from "react";
import { Badge, DataTable } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import type { Customer, CustomerType } from "@/lib/types";

const filters: (CustomerType | "All")[] = ["All", "Hotel", "Restaurant", "Chef", "Wholesale", "Retail Partner", "Corporate", "B2C Segment"];

export function CustomerTable({ customers }: { customers: Customer[] }) {
  const [type, setType] = useState<CustomerType | "All">("All");
  const selectId = useId();
  const rows = type === "All" ? customers : customers.filter((c) => c.type === type);
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label htmlFor={selectId} className="text-sm font-medium">Show</label>
        <select id={selectId} value={type} onChange={(e) => setType(e.target.value as CustomerType | "All")} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          {filters.map((f) => (
            <option key={f} value={f}>{f === "All" ? "All customers" : f}</option>
          ))}
        </select>
        <p role="status" className="text-sm text-muted">{rows.length} shown</p>
      </div>
      <DataTable
        caption="Customers and B2B accounts"
        rows={rows}
        rowKey={(c) => c.id}
        columns={[
          { header: "Customer", cell: (c) => <span><span className="font-semibold">{c.name}</span><span className="block text-xs text-muted">{c.segment}</span></span> },
          { header: "Type", cell: (c) => c.type },
          { header: "Contact (mock)", cell: (c) => <span className="text-xs"><span className="block text-sm">{c.contactName}</span>{c.phone}<br />{c.email}</span> },
          { header: "Last interaction", cell: (c) => <span className="block max-w-[14rem]"><span className="text-xs text-muted">{formatDate(c.lastInteractionDate)}</span><br />{c.lastInteractionNote}</span> },
          { header: "Follow-up", cell: (c) => (c.followUpDate ? formatDate(c.followUpDate) : <span className="text-muted">Not set</span>) },
          { header: "Opportunity", cell: (c) => <Badge>{c.opportunity}</Badge> },
          { header: "Notes", cell: (c) => <span className="block max-w-[16rem] text-xs">{c.notes}</span> },
        ]}
      />
    </div>
  );
}

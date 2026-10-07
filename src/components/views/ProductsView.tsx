"use client";

import Link from "next/link";
import { useAppData } from "@/components/AppDataProvider";
import { Badge, Card, DataTable, EmptyState, Stat } from "@/components/ui";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";
import { formatThb } from "@/lib/dates";
import { productAlerts, shopNote } from "@/lib/queries";

export function ProductsView() {
  const { data } = useAppData();
  const products = data.products;
  // Drafts are listed, but only live products count as low or out of stock.
  const live = products.filter((p) => p.status === "Active");
  const drafts = products.length - live.length;

  if (products.length === 0) {
    return (
      <EmptyState>
        {DATA_NOT_AVAILABLE} {shopNote(data)} Products, prices and stock come from your shop. See the{" "}
        <Link href="/channels" className="font-semibold text-sage underline">Channels page</Link>.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat accent="sage" label="Products" value={String(products.length)} note={[data.shop?.note ?? "From your shop", drafts ? `${drafts} draft${drafts === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ")} tone="flat" />
        <Stat accent="butter" label="In stock" value={String(live.filter((p) => p.stockStatus === "In stock").length)} note="Live products" tone="flat" />
        <Stat accent="sky" label="Low stock" value={String(live.filter((p) => p.stockStatus === "Low stock").length)} note="Check before promoting" tone="flat" />
        <Stat accent="blush" label="Out of stock" value={String(live.filter((p) => p.stockStatus === "Out of stock").length)} note="Live products" tone="flat" />
      </div>

      {productAlerts(data).length > 0 && (
        <Card id="attention" title="Products requiring marketing attention" subtitle="Low or out of stock: do not promote until stock is confirmed">
          <ul className="space-y-2">
            {productAlerts(data).map((a) => (
              <li key={a.id} className="flex gap-3 text-[15px]"><Badge>{a.severity}</Badge>{a.message}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card id="list" title="Product list" subtitle="Read-only from your shop">
        <DataTable
          caption="Products"
          rows={products}
          rowKey={(p) => p.id}
          columns={[
            { header: "Product", cell: (p) => <span className="font-semibold">{p.name}</span> },
            { header: "Category", cell: (p) => p.category },
            { header: "Status", cell: (p) => <Badge>{p.status}</Badge> },
            { header: "Price", cell: (p) => <span>{formatThb(p.priceThb)}{p.priceUnit && <span className="block text-xs text-muted">{p.priceUnit}</span>}</span>, className: "text-right" },
            { header: "Availability", cell: (p) => <Badge>{p.availability}</Badge> },
            { header: "Stock", cell: (p) => <span><Badge>{p.stockStatus}</Badge><span className="mt-1 block text-xs text-muted">{p.stockUnits === null ? `Units: ${DATA_NOT_AVAILABLE}` : `${p.stockUnits} units`}</span></span> },
          ]}
        />
      </Card>
    </div>
  );
}

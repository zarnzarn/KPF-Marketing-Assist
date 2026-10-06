import { products } from "@/data/mock";
import { Badge, Card, ChangeText, DataTable, PageHeader, Stat } from "@/components/ui";
import { formatThb } from "@/lib/dates";
import { revenueByProduct } from "@/lib/queries";

export const metadata = { title: "Products · Klong Phai Farm (Prototype)" };

export default function ProductsPage() {
  const performance = new Map(revenueByProduct().map((r) => [r.product.id, r]));
  const attention = products.filter((p) => p.attentionReason);
  return (
    <>
      <PageHeader title="Products" subtitle="Mock product list with price, availability, stock and performance. Prices are mock values." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Products" value={String(products.length)} note={`${products.filter((p) => p.status === "Active").length} active`} tone="flat" />
        <Stat label="New products" value={String(products.filter((p) => p.isNew).length)} note="Launching soon" tone="flat" />
        <Stat label="Low or out of stock" value={String(products.filter((p) => p.stockStatus === "Low stock" || p.stockStatus === "Out of stock").length)} note="Check before promoting" tone="down" />
        <Stat label="Need marketing attention" value={String(attention.length)} note="See list below" tone="down" />
      </div>

      <Card id="attention" title="Products requiring marketing attention" className="mt-6">
        <ul className="space-y-3">
          {attention.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-2">
              <span>
                <span className="block font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{p.attentionReason}</span>
              </span>
              <span className="flex gap-2">{p.isNew && <Badge tone="gold">New</Badge>}<Badge>{p.stockStatus}</Badge></span>
            </li>
          ))}
        </ul>
      </Card>

      <Card id="list" title="Product list" className="mt-6">
        <DataTable
          caption="Products"
          rows={products}
          rowKey={(p) => p.id}
          columns={[
            { header: "Product", cell: (p) => <span className="font-semibold">{p.name}</span> },
            { header: "Category", cell: (p) => p.category },
            { header: "Status", cell: (p) => <Badge>{p.status}</Badge> },
            { header: "Price (mock)", cell: (p) => <span>{formatThb(p.priceThb)}<span className="block text-xs text-muted">{p.priceUnit}</span></span> },
            { header: "Channels", cell: (p) => <span className="block max-w-[12rem] text-xs">{p.channels.join(", ")}</span> },
            { header: "Availability", cell: (p) => <Badge>{p.availability}</Badge> },
            { header: "Stock", cell: (p) => <span><Badge>{p.stockStatus}</Badge><span className="mt-1 block text-xs text-muted">{p.stockUnits} units (reorder at {p.reorderLevel})</span></span> },
            { header: "Sep revenue", cell: (p) => { const r = performance.get(p.id); return r ? <span>{formatThb(r.current)}<span className="block text-xs"><ChangeText change={r.change} /></span></span> : <span className="text-muted">Data not available.</span>; }, className: "text-right" },
          ]}
        />
      </Card>
    </>
  );
}

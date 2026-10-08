import { PageHeader } from "@/components/ui";
import { ProductsView } from "@/components/views/ProductsView";

export const metadata = { title: "Products · Klong Phai Farm" };

export default function ProductsPage() {
  return (
    <>
      <PageHeader title="Products" subtitle="Products, prices and stock, read from your shop. Prices are never changed from this app." />
      <ProductsView />
    </>
  );
}

import { WhenReady } from "@/components/AppDataProvider";
import { PageHeader } from "@/components/ui";
import { CustomersView } from "@/components/views/CustomersView";

export const metadata = { title: "Customers & B2B · Klong Phai Farm" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers & B2B" subtitle="Accounts, follow-ups and customer issues. Saved in this browser only, without personal contact details." />
      <WhenReady>
        <CustomersView />
      </WhenReady>
    </>
  );
}

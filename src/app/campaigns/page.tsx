import { PageHeader } from "@/components/ui";
import { CampaignsView } from "@/components/views/CampaignsView";

export const metadata = { title: "Campaigns · Klong Phai Farm" };

export default function CampaignsPage() {
  return (
    <>
      <PageHeader title="Campaigns" subtitle="Plan campaigns with objective, dates, budget and approval status. Saved in this browser only; nothing is launched from this app." />
      <CampaignsView />
    </>
  );
}

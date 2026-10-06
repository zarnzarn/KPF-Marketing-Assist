import { PageHeader } from "@/components/ui";
import { SecretaryChat } from "@/components/SecretaryChat";

export const metadata = { title: "AI Secretary · Klong Phai Farm (Prototype)" };

export default function SecretaryPage() {
  return (
    <>
      <PageHeader
        title="AI Secretary"
        subtitle="Ask about your day. Answers come from mock data only, with every statement labelled. No real AI is connected yet."
      />
      <SecretaryChat />
    </>
  );
}

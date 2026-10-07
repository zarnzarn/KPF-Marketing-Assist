import { redirect } from "next/navigation";
import { setupProblem } from "@/lib/mode";

export const metadata = { title: "Setup needed · Klong Phai Farm" };
export const dynamic = "force-dynamic";

const missing = {
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "ALLOWED_EMAIL"],
  "allowed-email": ["ALLOWED_EMAIL"],
};

/** Shown on a host until the login settings exist. It names the missing settings, never any values. */
export default function SetupPage() {
  const problem = setupProblem();
  if (!problem) redirect("/");
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-card p-8">
        <h1 className="mb-3 text-3xl font-semibold text-forest">Setup needed</h1>
        <p className="mb-4 text-muted">The app is online but its login settings are not complete, so it shows no data. Add these environment variables in Vercel (Project, Settings, Environment Variables), then redeploy:</p>
        <ul className="mb-4 list-disc space-y-1 pl-5 font-mono text-sm">
          {missing[problem].map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">Step-by-step help is in the README, section &ldquo;Put it online&rdquo;.</p>
      </div>
    </main>
  );
}

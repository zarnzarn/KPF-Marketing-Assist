import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { getViewer } from "@/lib/auth/session";
import { setupProblem, supabaseSettings } from "@/lib/mode";

export const metadata = { title: "Log in · Klong Phai Farm" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  link: "That login link has expired or was already used. Ask for a new one below.",
  "not-allowed": "This email address is not allowed to use this app.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (setupProblem()) redirect("/setup");
  const settings = supabaseSettings();
  if (!settings) redirect("/"); // local mode needs no login
  if (await getViewer()) redirect("/");
  const { error } = await searchParams;

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-8 shadow-[0_8px_24px_-14px_rgba(36,25,5,0.25)]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yolk-soft text-forest ring-1 ring-yolk/50" aria-hidden="true">
            <Leaf className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-xl leading-tight font-semibold text-forest">Klong Phai Farm</p>
            <p className="text-sm text-muted">Marketing Director Secretary</p>
          </div>
        </div>
        <h1 className="mb-2 text-3xl font-semibold text-forest">Log in</h1>
        <p className="mb-6 text-sm text-muted">Enter your email address. We will send you a link that logs you in. No password needed.</p>
        {error && errors[error] && (
          <p role="alert" className="mb-4 rounded-xl bg-clay-soft p-3 text-sm font-medium text-clay">
            {errors[error]}
          </p>
        )}
        <LoginForm settings={settings} />
      </div>
    </main>
  );
}

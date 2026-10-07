// The login email links lead here. It turns the link into a session, then lets in only ALLOWED_EMAIL.
// Two link kinds work: "?code=…" (Supabase's default email, same browser) and
// "?token_hash=…&type=email" (the edited email template from the README, any device).
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, setupProblem, supabaseSettings } from "@/lib/mode";
import { serverSupabase } from "@/lib/supabase/server";

const LINK_TYPES: readonly string[] = ["email", "magiclink"];

export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (setupProblem() || !supabaseSettings()) return to("/");

  const supabase = await serverSupabase();
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") ?? "";

  let signedIn = false;
  if (code) signedIn = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && LINK_TYPES.includes(type)) signedIn = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })).error;
  if (!signedIn) return to("/login?error=link");

  const { data } = await supabase.auth.getUser();
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return to("/login?error=not-allowed");
  }
  return to("/");
}

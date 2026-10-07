// Runs before every page request. In online mode it keeps the login session fresh and sends
// signed-out visitors to /login early. The real check is requireViewer() on the server
// (src/lib/auth/session.ts); this is only the first, quick one.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { setupProblem, supabaseSettings } from "@/lib/mode";

/** Pages anyone may open: the login page, the email-link handlers and the setup help. */
export function isPublicPath(path: string): boolean {
  return path === "/login" || path === "/setup" || path.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (setupProblem()) return isPublicPath(path) ? NextResponse.next() : NextResponse.redirect(new URL("/setup", request.url));

  const settings = supabaseSettings();
  if (!settings) return NextResponse.next(); // local mode: no login

  let response = NextResponse.next({ request });
  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && !isPublicPath(path)) return NextResponse.redirect(new URL("/login", request.url));
  return response;
}

export const config = {
  // Everything except Next's own files and the app icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)"],
};

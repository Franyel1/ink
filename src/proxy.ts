import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Reachable without a session. `/offline` is here so the service worker can
// precache it, and so it still renders if the session has lapsed by the time you
// open the app with no signal.
const PUBLIC_PATHS = ["/login", "/offline"];

// Pointless once you're signed in — bounce to the feed. `/offline` deliberately
// isn't one of these: the worker has to be able to fetch it while signed in.
const SIGNED_OUT_ONLY_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // The fictional demo is entirely local and must work without backend credentials.
  if (request.nextUrl.pathname === "/demo" || request.nextUrl.pathname.startsWith("/demo/")) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if needed; required for server components to see it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) return NextResponse.json({error:"unauthorized"},{status:401});
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && SIGNED_OUT_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

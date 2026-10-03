import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isAttorneyPortalApiPath } from "@/lib/attorney/portal-api-allowlist";
import { createMiddlewareAuthBudget } from "@/lib/middleware/auth-budget";
import {
  isMiddlewarePublicPath,
  isMiddlewareStaticPath,
  matchesPath,
} from "@/lib/middleware/paths";
import type { CookieToSet } from "@/lib/supabase/cookie-types";

const CRM_STAFF = new Set(["dev", "admin", "acct_manager"]);
const OPS_LEAD = new Set(["dev", "admin"]);
const COMMS_AND_SETTINGS = new Set([
  "dev",
  "admin",
  "acct_manager",
  "attorney",
]);
const ATTORNEY_ROUTE_ROLES = new Set(["dev", "admin", "attorney"]);

function redirectTo(req: NextRequest, path: string) {
  const u = req.nextUrl.clone();
  u.pathname = path;
  return NextResponse.redirect(u);
}

function homeForRole(role: string) {
  return role === "attorney" ? "/attorney/cases" : "/dashboard";
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isMiddlewarePublicPath(pathname) || isMiddlewareStaticPath(pathname)) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const budget = createMiddlewareAuthBudget();

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Timeout must not clear or rotate the session.
          if (budget.skipCookieWrites()) return;
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
      global: {
        fetch: budget.fetchWithBudget,
      },
    });

    let user: { id: string } | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Budget exceeded or Auth unreachable — pass through; pages re-check.
      return response;
    }

    if (!user || pathname === "/login" || pathname === "/signup") {
      return response;
    }

    let role: string | undefined;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = profile?.role as string | undefined;
    } catch {
      return response;
    }

    if (!role) return response;

    if (pathname === "/portal/setup" || pathname === "/portal/invalid-token") {
      return response;
    }

    /* Portal is client-only */
    if (pathname.startsWith("/portal")) {
      if (role !== "client") {
        return redirectTo(request, homeForRole(role));
      }
      return response;
    }

    /* Client users only see portal */
    if (role === "client") {
      return redirectTo(request, "/portal");
    }

    /* Attorney workspace (/attorney/*): dev, admin, attorney — not acct_manager */
    if (pathname.startsWith("/attorney")) {
      if (!ATTORNEY_ROUTE_ROLES.has(role)) {
        return redirectTo(request, homeForRole(role));
      }
      if (role === "attorney") {
        const attorneyPortalOk =
          pathname === "/attorney/cases" ||
          pathname.startsWith("/attorney/cases/") ||
          pathname === "/attorney/settings" ||
          pathname.startsWith("/attorney/settings/");
        if (!attorneyPortalOk) {
          return redirectTo(request, "/attorney/cases");
        }
      }
      return response;
    }

    /* Attorneys: cases + settings only (under /attorney/*).
     *
     * LOCKED (Aug 2026): also allow ATTORNEY_PORTAL_API_ALLOWLIST paths.
     * Without /api/clients/documents/download, portal Download/Preview bounce
     * attorneys to Cases. See lib/attorney/portal-api-allowlist.ts +
     * .cursor/rules/attorney-portal-middleware.mdc */
    if (role === "attorney") {
      if (isAttorneyPortalApiPath(pathname)) {
        return response;
      }
      if (matchesPath(pathname, "/settings")) {
        return redirectTo(request, "/attorney/settings");
      }
      return redirectTo(request, "/attorney/cases");
    }

    /* Team management */
    if (pathname === "/team" || pathname.startsWith("/team/")) {
      if (!OPS_LEAD.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* Reports */
    if (pathname === "/reports" || pathname.startsWith("/reports/")) {
      if (!OPS_LEAD.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* Dev-only bulk user creation */
    if (pathname === "/admin/bulk-invite") {
      if (role !== "dev") {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* Admin surface (attorney queue, bulk invite) */
    if (pathname.startsWith("/admin")) {
      if (!CRM_STAFF.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* Dashboard, clients, pipeline, reminders */
    const corePrefixes = ["/dashboard", "/clients", "/pipeline", "/reminders"];
    if (corePrefixes.some((p) => matchesPath(pathname, p))) {
      if (!CRM_STAFF.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* Communications hub */
    if (matchesPath(pathname, "/communications")) {
      if (!COMMS_AND_SETTINGS.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* E-Sign documents: dev and admin, not admin alone. */
    if (matchesPath(pathname, "/esign-documents")) {
      if (!OPS_LEAD.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* Field placement is leadership-only, same as MID administration. */
    if (matchesPath(pathname, "/esign-templates")) {
      if (!OPS_LEAD.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    /* MID + e-sign template administration */
    if (matchesPath(pathname, "/settings/mids")) {
      if (!OPS_LEAD.has(role)) {
        return redirectTo(request, "/settings");
      }
      return response;
    }

    /* Settings */
    if (matchesPath(pathname, "/settings")) {
      if (!COMMS_AND_SETTINGS.has(role)) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    return response;
  } finally {
    budget.dispose();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

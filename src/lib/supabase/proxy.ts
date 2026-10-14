import "server-only";

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ORIGINAL_SEARCH_HEADER } from "@/lib/original-search-header";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./public-env";

export async function refreshSupabaseSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ORIGINAL_SEARCH_HEADER, request.nextUrl.search);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { publishableKey, url } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request: { headers: requestHeaders } });

        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

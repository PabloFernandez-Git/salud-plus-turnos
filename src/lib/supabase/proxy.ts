import "server-only";

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ORIGINAL_SEARCH_HEADER } from "@/lib/original-search-header";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./public-env";

export async function refreshSupabaseSession(request: NextRequest) {
  function forwardedRequestHeaders() {
    const headers = new Headers(request.headers);
    headers.set(ORIGINAL_SEARCH_HEADER, request.nextUrl.search);
    return headers;
  }

  let response = NextResponse.next({ request: { headers: forwardedRequestHeaders() } });
  const { publishableKey, url } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request: { headers: forwardedRequestHeaders() } });

        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

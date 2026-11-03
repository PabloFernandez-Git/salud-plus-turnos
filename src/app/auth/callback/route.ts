import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { allowedCallbackDestination } from "@/modules/access/domain/access-routing";
import { getAppOrigin } from "@/modules/access/server/app-origin";

function loginErrorResponse() {
  return NextResponse.redirect(new URL("/login?error=invalid_callback", getAppOrigin()));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = allowedCallbackDestination(request.nextUrl.searchParams.get("next"));

  if (!code) return loginErrorResponse();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return loginErrorResponse();

  return NextResponse.redirect(new URL(destination, getAppOrigin()));
}

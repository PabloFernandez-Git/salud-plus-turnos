import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { allowedCallbackDestination } from "@/modules/access/domain/access-routing";

function loginErrorResponse(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = allowedCallbackDestination(request.nextUrl.searchParams.get("next"));

  if (!code) return loginErrorResponse(request);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return loginErrorResponse(request);

  return NextResponse.redirect(new URL(destination, request.url));
}

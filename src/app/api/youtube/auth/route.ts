import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/youtube/client";
import { getAdminUserId } from "@/lib/admin-guard";

const STATE_COOKIE = "yt_oauth_state";

function getRedirectUri(req: NextRequest): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${new URL(req.url).origin}/api/youtube/callback`
  );
}

export async function GET(req: NextRequest) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const state = randomBytes(24).toString("base64url");
  const url = buildAuthUrl(getRedirectUri(req), state);

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 min pra completar o flow
    path: "/api/youtube",
  });
  return response;
}

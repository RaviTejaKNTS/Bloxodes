import { NextResponse } from "next/server";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/sitemaps/games.xml", request.url), 308);
}

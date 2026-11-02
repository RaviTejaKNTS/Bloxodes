import { NextResponse } from "next/server";
import { withSiteUrl } from "@/lib/sitemap";

export function GET(_request: Request) {
  return NextResponse.redirect(withSiteUrl("/sitemaps/games.xml"), 308);
}

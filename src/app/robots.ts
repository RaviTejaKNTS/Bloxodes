import type { MetadataRoute } from "next";
import { SEARCH_INDEXING_ENABLED, SITE_URL } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  if (!SEARCH_INDEXING_ENABLED) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/"
        }
      ]
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin"]
      }
    ],
    sitemap: `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`
  };
}

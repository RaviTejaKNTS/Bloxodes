import "./globals.css";
import { ReactNode } from "react";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { SEARCH_INDEXING_ENABLED } from "@/lib/site-config";

const alternatesTypes = { "application/rss+xml": `${SITE_URL}/feed.xml` };
export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  generator: "Next.js",
  title: {
    default: `${SITE_NAME} — Active & Working Codes`,
    template: "%s"
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Roblox codes",
    "Roblox game codes",
    "Bloxodes",
    "gaming rewards",
    "promo codes"
  ],
  category: "Gaming",
  publisher: SITE_NAME,
  creator: SITE_NAME,
  robots: {
    index: SEARCH_INDEXING_ENABLED,
    follow: SEARCH_INDEXING_ENABLED,
    googleBot: {
      index: SEARCH_INDEXING_ENABLED,
      follow: SEARCH_INDEXING_ENABLED,
      maxSnippet: -1,
      maxImagePreview: "large",
      maxVideoPreview: -1
    }
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Active & Working Codes`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/Bloxodes.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Roblox Codes`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Active & Working Codes`,
    description: SITE_DESCRIPTION,
    creator: "@bloxodes",
    site: "@bloxodes",
    images: [`${SITE_URL}/Bloxodes.png`]
  },
  alternates: {
    types: alternatesTypes
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" }
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: ["/favicon.ico"]
  },
  verification: {
    google: "m-QfA406lK-3WGDXN0yV6Cv8hXoLI0RBnJBtndIyAp4"
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark" data-theme="dark">
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <ThemeBootstrap />
        <>
          {children}
        </>
      </body>
    </html>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { RailLinkList } from "@/components/RailLinkList";
import { SocialShare } from "@/components/SocialShare";

// One more page than the rail shows, so it keeps six links when the reader is on one of them.
const pages = [
  { href: "/catalog/free-roblox-items", title: "Free Roblox items", description: "Find free accessories, clothing, body parts and avatar bundles." },
  { href: "/catalog/roblox-promo-codes", title: "Roblox promo codes", description: "Browse avatar rewards and the codes used to redeem them." },
  { href: "/catalog/roblox-music-ids", title: "Roblox music IDs", description: "Find songs and copy audio IDs for radios and boomboxes." },
  { href: "/catalog/roblox-decal-ids", title: "Roblox decal IDs", description: "Find images and copy decal IDs for your Roblox creations." },
  { href: "/catalog/roblox-items-and-bundles", title: "Roblox items and bundles", description: "Browse Marketplace accessories, clothing, emotes and animations." },
  { href: "/catalog/roblox-color-codes", title: "Roblox color codes", description: "Copy BrickColor numbers, RGB values and hex color codes." },
  { href: "/catalog/admin-commands", title: "Roblox admin commands", description: "Commands for HD Admin, Kohl's Admin, Basic Admin Essentials and Adonis." }
];

const VISIBLE_PAGES = 6;

/** The catalog layout can't see the path, so the rail reads it here to skip the page the reader is on. */
export function CatalogSidebarContent({ siteUrl }: { siteUrl: string }) {
  const pathname = usePathname() ?? "/catalog";
  const related = pages
    .filter((page) => pathname !== page.href && !pathname.startsWith(`${page.href}/`))
    .slice(0, VISIBLE_PAGES);

  return (
    <>
      <SocialShare url={`${siteUrl.replace(/\/$/, "")}${pathname}`} title="Roblox catalogs" heading="Share with your friends" />
      <RailLinkList heading="More catalog pages" links={related} />
    </>
  );
}

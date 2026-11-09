import { robloxAugust2026Report } from "./roblox-august-2026";
import { robloxJune2026Report } from "./roblox-june-2026";
import { robloxJuly2026Report } from "./roblox-july-2026";
import { robloxSeptember2026Report } from "./roblox-september-2026";

/**
 * Published monthly stats reports, newest first. The /stats/reports index and the stats rail
 * both read this list, so adding a report here updates both. Unlisted (noindex) reports stay out.
 */
export const PUBLISHED_STATS_REPORTS = [
  {
    href: `/stats/reports/${robloxSeptember2026Report.slug}`,
    updatedAt: robloxSeptember2026Report.updatedAt,
    publishedAt: robloxSeptember2026Report.publishedAt,
    month: robloxSeptember2026Report.featureImage.month,
    title: robloxSeptember2026Report.title,
    description: robloxSeptember2026Report.subtitle,
    image: robloxSeptember2026Report.featureImage
  },
  {href: `/stats/reports/${robloxAugust2026Report.slug}`, month: robloxAugust2026Report.featureImage.month, title: robloxAugust2026Report.title, description: robloxAugust2026Report.subtitle, image: robloxAugust2026Report.featureImage, updatedAt: robloxAugust2026Report.updatedAt, publishedAt: robloxAugust2026Report.publishedAt},
  {
    href: `/stats/reports/${robloxJuly2026Report.slug}`,
    updatedAt: robloxJuly2026Report.updatedAt,
    publishedAt: robloxJuly2026Report.publishedAt,
    month: robloxJuly2026Report.featureImage.month,
    title: robloxJuly2026Report.title,
    description: robloxJuly2026Report.subtitle,
    image: robloxJuly2026Report.featureImage
  },
  {
    href: `/stats/reports/${robloxJune2026Report.slug}`,
    updatedAt: robloxJune2026Report.updatedAt,
    publishedAt: robloxJune2026Report.publishedAt,
    month: robloxJune2026Report.featureImage.month,
    title: robloxJune2026Report.title,
    description: robloxJune2026Report.subtitle,
    image: robloxJune2026Report.featureImage
  }
] as const;

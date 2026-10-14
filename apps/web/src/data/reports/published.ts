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
    month: robloxSeptember2026Report.featureImage.month,
    title: robloxSeptember2026Report.title,
    description: robloxSeptember2026Report.subtitle,
    image: robloxSeptember2026Report.featureImage
  },
  {
    href: `/stats/reports/${robloxJuly2026Report.slug}`,
    month: robloxJuly2026Report.featureImage.month,
    title: robloxJuly2026Report.title,
    description: robloxJuly2026Report.subtitle,
    image: robloxJuly2026Report.featureImage
  },
  {
    href: `/stats/reports/${robloxJune2026Report.slug}`,
    month: robloxJune2026Report.featureImage.month,
    title: robloxJune2026Report.title,
    description: robloxJune2026Report.subtitle,
    image: robloxJune2026Report.featureImage
  }
] as const;

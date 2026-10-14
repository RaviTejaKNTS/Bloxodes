import { RailLinkList } from "@/components/RailLinkList";

export type ChecklistRelatedLink = {
  href: string;
  title: string;
  image?: string | null;
  itemsCount?: number | null;
};

/** Short sidebar list of other checklists (or other related pages). */
export function ChecklistRelatedList({ heading, links }: { heading: string; links: ChecklistRelatedLink[] }) {
  return (
    <RailLinkList
      heading={heading}
      links={links.map(link => ({
        href: link.href,
        title: link.title,
        image: link.image,
        description: typeof link.itemsCount === "number" ? `${link.itemsCount} tasks` : null
      }))}
    />
  );
}

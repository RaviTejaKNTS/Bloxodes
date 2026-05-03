import {
  Award,
  BookOpen,
  Calendar,
  Clock,
  FileText,
  KeyRound,
  LayoutGrid,
  List,
  Music,
  SquareCheckBig,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";

type IndexPageStatsProps = {
  items: Array<{
    label: string;
    icon?: "articles" | "catalog" | "checklists" | "clock" | "codes" | "events" | "lists" | "music" | "quizzes" | "tools" | "wiki";
    tone?: "accent" | "muted";
  }>;
  className?: string;
};

const iconMap = {
  articles: FileText,
  catalog: LayoutGrid,
  checklists: SquareCheckBig,
  clock: Clock,
  codes: KeyRound,
  events: Calendar,
  lists: List,
  music: Music,
  quizzes: Award,
  tools: Wrench,
  wiki: BookOpen
};

export function IndexPageStats({ items, className }: IndexPageStatsProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const Icon = item.icon ? iconMap[item.icon] : null;
        const isAccent = item.tone === "accent";

        return (
          <span
            key={item.label}
            className={cn(
              "inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-sm font-medium",
              isAccent
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border/70 bg-card text-muted"
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

import type { ReactNode } from "react";

export type ContentFaqItem = {
  id: string;
  question: string;
  answer: ReactNode;
};

export function ContentFaq({
  items,
  title = "FAQ",
  className
}: {
  items: ContentFaqItem[];
  title?: string;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <section className={className ?? "rounded-2xl border border-border/60 bg-surface/40 p-6 shadow-sm"}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/40 bg-background/60 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
              <p className="text-base font-semibold text-foreground">{item.question}</p>
            </div>
            <div className="md-copy-scope mt-2">{item.answer}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

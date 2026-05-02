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
    <section className={className ?? "border-t border-border/60 pt-6"}>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 divide-y divide-border/60">
        {items.map((item) => (
          <div key={item.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
              <p className="text-base font-semibold leading-6 text-foreground">{item.question}</p>
            </div>
            <div className="content-faq-answer md-copy-scope mt-2 sm:pl-8">{item.answer}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

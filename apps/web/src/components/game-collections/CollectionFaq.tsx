import { Fragment } from "react";
import type { ContentFaqItem } from "@/components/ContentFaq";

export function CollectionFaq({ items }: { items: ContentFaqItem[] }) {
  if (!items.length) return null;
  return (
    <>
      <h2 className="collections-faq-heading text-2xl font-semibold tracking-tight text-foreground">FAQ</h2>
      {items.map(item => (
        <Fragment key={item.id}>
          <div className="collections-faq-item">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
              <p className="text-base font-semibold leading-6 text-foreground">{item.question}</p>
            </div>
            <div className="content-faq-answer md-copy-scope mt-2 sm:pl-8">{item.answer}</div>
          </div>
        </Fragment>
      ))}
    </>
  );
}

import type { ContentFaqItem } from "@/components/ContentFaq";

export function CatalogFaq({ items, title = "FAQ", className }: { items: ContentFaqItem[]; title?: string; className?: string }) {
  if (!items.length) return null;
  return (
    <>
      <div className={`catalog-faq-heading ${className ?? ""}`}>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {items.map(item => (
        <div key={item.id} className="catalog-faq-item">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
            <p className="text-base font-semibold leading-6 text-foreground">{item.question}</p>
          </div>
          <div className="content-faq-answer md-copy-scope mt-2 sm:pl-8">{item.answer}</div>
        </div>
      ))}
    </>
  );
}

import type { ContentFaqItem } from "@/components/ContentFaq";

export function ToolFaq({ items }: { items: ContentFaqItem[] }) {
  return <>{items.map((item, index) => (
    <section key={item.id} className={`ads-tools-faq-item ${index === 0 ? "border-t border-border/60 pt-6" : "border-t border-border/60 pt-4"} ${index === items.length - 1 ? "pb-0" : "pb-4"}`}>
      {index === 0 ? <h2 className="text-2xl font-semibold tracking-tight text-foreground">FAQ</h2> : null}
      <div className={index === 0 ? "mt-4" : undefined}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
          <p className="text-base font-semibold leading-6 text-foreground">{item.question}</p>
        </div>
        <div className="content-faq-answer md-copy-scope mt-2 sm:pl-8">{item.answer}</div>
      </div>
    </section>
  ))}</>;
}

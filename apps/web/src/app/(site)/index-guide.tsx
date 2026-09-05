import type { ReactNode } from "react";
import "@/styles/article-content.css";

export type IndexGuideSection = {
  id: string;
  label: string;
  title: string;
  content: ReactNode;
};

export function IndexGuideLinks({ sections }: { sections: IndexGuideSection[] }) {
  return (
    <nav aria-label="On this page" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {sections.map(({ id, label }) => (
        <a key={id} href={`#${id}`} className="rounded-sm text-foreground underline decoration-border underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          {label}
        </a>
      ))}
    </nav>
  );
}

export function IndexGuide({ sections }: { sections: IndexGuideSection[] }) {
  return sections.map(({ id, title, content }) => (
    <section key={id} aria-labelledby={id} className="article-content md-copy-scope max-w-3xl pt-4">
      <h2 data-md-copy id={id} className="scroll-mt-24">{title}</h2>
      {content}
    </section>
  ));
}

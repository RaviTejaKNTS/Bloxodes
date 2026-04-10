import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WikiRow = {
  label: string;
  value: ReactNode;
};

export type WikiLinkItem = {
  href: string;
  title: string;
  description?: string | null;
  meta?: string | null;
};

export function WikiSection({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border/60 pt-8", className)}>
      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <h2 className="mb-0 text-xl font-semibold leading-tight text-foreground md:text-2xl">{title}</h2>
          {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

export function WikiRows({ rows, className }: { rows: WikiRow[]; className?: string }) {
  if (!rows.length) return null;

  return (
    <dl className={cn("divide-y divide-border/50 rounded-xl border border-border/60 bg-surface/40", className)}>
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm font-medium text-muted">{row.label}</dt>
          <dd className="text-sm font-semibold leading-6 text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WikiLinkList({ items, className }: { items: WikiLinkItem[]; className?: string }) {
  if (!items.length) return null;

  return (
    <div className={cn("divide-y divide-border/50 rounded-xl border border-border/60 bg-surface/40", className)}>
      {items.map((item) => {
        const className =
          "group grid gap-1 px-4 py-3 transition hover:bg-surface-muted/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4";
        const content = (
          <>
            <span>
              <span className="block text-sm font-semibold leading-6 text-foreground group-hover:text-accent">{item.title}</span>
              {item.description ? <span className="block text-sm leading-6 text-muted">{item.description}</span> : null}
            </span>
            {item.meta ? <span className="text-xs font-medium text-muted">{item.meta}</span> : null}
          </>
        );

        return item.href.startsWith("http") ? (
          <a key={`${item.href}-${item.title}`} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
            {content}
          </a>
        ) : (
          <Link key={`${item.href}-${item.title}`} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}

export function WikiInlineList({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
      {items.map((item, index) => (
        <span key={item}>
          {item}
          {index < items.length - 1 ? <span className="text-muted">, </span> : null}
        </span>
      ))}
    </span>
  );
}

export function WikiTable({
  columns,
  rows,
  className
}: {
  columns: string[];
  rows: ReactNode[][];
  className?: string;
}) {
  if (!rows.length) return null;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-surface/40", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border/60 text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

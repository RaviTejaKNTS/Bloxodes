import { useState, type ReactNode, type SyntheticEvent } from 'react';
/** SVG marks expose the same tooltip to pointer and keyboard users. */
export function ChartTooltip({ children }: { children: ReactNode; }) {
  const [label, setLabel] = useState('');
  function show(event: SyntheticEvent) {
    const target = event.target;
    if (target instanceof Element) setLabel(target.closest('g[aria-label]')?.getAttribute('aria-label') ?? '');
  }
  return <div className="relative min-w-0" onFocus={show} onBlur={() => setLabel('')} onMouseOver={show} onMouseLeave={() => setLabel('')}>
    {children}
    {label && <div role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 max-w-full rounded border border-border bg-surface p-2 text-xs shadow">{label}</div>}
  </div>;
}

"use client";

import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const pretty = (id: string) => id.replace(/^minecraft:/, "").replace(/^#/, "Any ").replaceAll("_", " ");
export const format = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
export function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number; step?: number }) {
  const id = useId();
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(event.target.value)} /></div>;
}
export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId();
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></div>;
}
export function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  const id = useId();
  return <div className="space-y-2"><label id={id} className="text-sm font-medium">{label}</label><Select value={value || undefined} onValueChange={onChange}><SelectTrigger aria-labelledby={id}><SelectValue placeholder="Choose an option">{options.find(option => option.value === value)?.label}</SelectValue></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}
export function Panel({ children }: { children: ReactNode }) { return <div className="not-prose space-y-5 rounded-xl border border-border/60 bg-surface p-4 sm:p-6">{children}</div>; }
export function Fields({ children }: { children: ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
export function Result({ error, children }: { error?: string | null; children: ReactNode }) {
  return <div aria-live="polite" aria-atomic="true" className="rounded-lg border border-border/60 bg-surface-muted p-4">{error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p> : children}</div>;
}
export function Metrics({ rows }: { rows: Array<[string, string | number]> }) { return <dl className="grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-lg font-semibold text-foreground">{typeof value === "number" ? format(value) : value}</dd></div>)}</dl>; }
export function Materials({ title, values }: { title: string; values: Record<string, number> }) {
  return <div className="space-y-2"><h3 className="text-base font-semibold">{title}</h3>{Object.keys(values).length ? <ul className="space-y-1 text-sm">{Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([id, count]) => <li key={id}>{pretty(id)}: {format(count)}</li>)}</ul> : <p className="text-sm text-muted">None required.</p>}</div>;
}
export function calculate<T>(fn: () => T): { value: T | null; error: string | null } {
  try { return { value: fn(), error: null }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : "Check your inputs." }; }
}
export function readNumber(value: string) { if (!value.trim()) throw new Error("Enter every required number."); return Number(value); }
export function Download({ value, name, mime, children }: { value: string; name: string; mime: string; children: ReactNode }) {
  return <Button type="button" variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([value], { type: mime })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>{children}</Button>;
}

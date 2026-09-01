"use client";

import { useEffect, useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  BADGE_PLANNER_MAX_EXPERIENCES,
  BADGE_RULES_VERIFIED_DATE,
  calculateBadgeAwardBudget,
  FREE_BADGES_PER_UTC_DAY,
  PAID_BADGE_CREATION_COST,
  planBadgeCreations
} from "@/lib/roblox-platform-tools/badge-cost-quota-planner";

type ExperienceRow = { id: number; label: string; universeId: string; planned: string; remaining: string };

function compactSchedule(schedule: Array<{ utcDate: string; freeBadges: number }>) {
  if (schedule.length <= 4) return schedule.map((entry) => ({ ...entry, hidden: false }));
  return [
    ...schedule.slice(0, 3).map((entry) => ({ ...entry, hidden: false })),
    { utcDate: `${schedule.length - 4} middle UTC days`, freeBadges: 0, hidden: true },
    { ...schedule[schedule.length - 1]!, hidden: false }
  ];
}

export function BadgeCostQuotaPlannerClient() {
  const [rows, setRows] = useState<ExperienceRow[]>([{ id: 1, label: "Main experience", universeId: "", planned: "6", remaining: "5" }]);
  const [nextId, setNextId] = useState(2);
  const [daysAvailable, setDaysAvailable] = useState("2");
  const [utcDate, setUtcDate] = useState("");
  const [utcClock, setUtcClock] = useState("");
  const [nextResetLocal, setNextResetLocal] = useState("");
  const [awardUsers, setAwardUsers] = useState("10");
  const [plannedCalls, setPlannedCalls] = useState("375");

  useEffect(() => {
    const now = new Date();
    const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    setUtcDate(now.toISOString().slice(0, 10));
    setUtcClock(now.toISOString().replace("T", " ").slice(0, 19) + " UTC");
    setNextResetLocal(new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(nextReset));
  }, []);

  const plan = useMemo(() => utcDate ? planBadgeCreations({
    rows: rows.map((row) => ({ label: row.label, universeId: row.universeId, plannedInput: row.planned, remainingTodayInput: row.remaining })),
    daysAvailableInput: daysAvailable,
    startUtcDate: utcDate
  }) : { result: null, errors: [] }, [rows, daysAvailable, utcDate]);
  const award = useMemo(() => calculateBadgeAwardBudget(awardUsers, plannedCalls), [awardUsers, plannedCalls]);

  function updateRow(id: number, field: keyof Omit<ExperienceRow, "id">, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function addRow() {
    if (rows.length >= BADGE_PLANNER_MAX_EXPERIENCES) return;
    setRows((current) => [...current, { id: nextId, label: `Experience ${nextId}`, universeId: "", planned: "0", remaining: "5" }]);
    setNextId((value) => value + 1);
  }

  return (
    <div className="tool-surface space-y-8">
      <section className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
        <div className="panel space-y-5 p-6">
          <div><h2 className="text-xl font-semibold text-foreground">Plan badge creation by experience</h2><p className="mt-2 text-sm leading-6 text-muted">Each universe gets its own five-free-badge allowance for the current UTC day. Places inside one universe share it.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-foreground">UTC days available, including today<input value={daysAvailable} onChange={(event) => setDaysAvailable(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label>
            <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm"><p className="font-semibold text-foreground">UTC quota clock</p><p className="mt-1 text-muted">{utcClock || "Loading current UTC time..."}</p><p className="mt-1 text-xs text-muted">Next 00:00 UTC reset locally: {nextResetLocal || "..."}</p></div>
          </div>

          <div className="space-y-4">{rows.map((row, index) => <div key={row.id} className="rounded-lg border border-border/60 bg-surface p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold text-foreground">Experience label<input aria-label={`Experience ${index + 1} label`} value={row.label} onChange={(event) => updateRow(row.id, "label", event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-foreground">Universe ID, optional<input aria-label={`${row.label} universe ID`} value={row.universeId} onChange={(event) => updateRow(row.id, "universeId", event.target.value)} inputMode="numeric" placeholder="Not a place ID" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-foreground">New badges planned<input aria-label={`${row.label} new badges planned`} value={row.planned} onChange={(event) => updateRow(row.id, "planned", event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-foreground">Free slots left today<input aria-label={`${row.label} free slots left today`} value={row.remaining} onChange={(event) => updateRow(row.id, "remaining", event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label></div>{rows.length > 1 ? <button type="button" onClick={() => setRows((current) => current.filter((entry) => entry.id !== row.id))} className="mt-3 text-xs font-semibold text-muted hover:text-foreground">Remove experience</button> : null}</div>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">Manual quota can become stale if another collaborator creates a badge.</p><button type="button" onClick={addRow} disabled={rows.length >= BADGE_PLANNER_MAX_EXPERIENCES} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-40">Add experience</button></div>
        </div>

        <div className="panel space-y-5 p-6" aria-live="polite">
          {!utcDate ? <p className="text-sm text-muted">Loading the UTC quota boundary...</p> : !plan.result ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"><ul className="list-disc space-y-1 pl-5">{plan.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : <>
            <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-accent/40 bg-accent/5 p-5"><p className="text-sm text-muted">Cost by deadline</p><p className="mt-1 text-3xl font-semibold text-foreground">{plan.result.totalCostByDeadline.toLocaleString("en-US")} Robux</p></div><div className="rounded-lg border border-border/60 bg-surface p-5"><p className="text-sm text-muted">Saved by waiting</p><p className="mt-1 text-3xl font-semibold text-foreground">{plan.result.totalSavings.toLocaleString("en-US")} Robux</p></div></div>
            <dl className="rounded-lg border border-border/60 bg-surface p-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Badges planned</dt><dd className="font-semibold text-foreground">{plan.result.totalPlanned.toLocaleString("en-US")}</dd></div><div className="mt-2 flex justify-between gap-4"><dt className="text-muted">Covered free by deadline</dt><dd className="font-semibold text-foreground">{plan.result.totalFreeByDeadline.toLocaleString("en-US")}</dd></div><div className="mt-2 flex justify-between gap-4"><dt className="text-muted">Paid creations by deadline</dt><dd className="font-semibold text-foreground">{plan.result.totalPaidByDeadline.toLocaleString("en-US")}</dd></div><div className="mt-2 flex justify-between gap-4"><dt className="text-muted">Cost to finish today</dt><dd className="font-semibold text-foreground">{plan.result.totalCostToday.toLocaleString("en-US")} Robux</dd></div></dl>
            {plan.result.rows.map((row) => <div key={`${row.label}-${row.universeId ?? "none"}`} className="rounded-lg border border-border/60 bg-surface p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-foreground">{row.label}</h3><p className="text-xs text-muted">Quota calculated separately for this universe</p></div><p className="font-semibold text-foreground">{row.costByDeadline.toLocaleString("en-US")} Robux</p></div><p className="mt-3 text-sm text-muted">{row.freeByDeadline} free, {row.paidByDeadline} paid by the deadline. Free-only finish: <strong className="text-foreground">{row.freeOnlyFinishDate ?? "No badges planned"}</strong>.</p>{row.schedule.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-foreground">Free-only UTC schedule</summary><ul className="mt-2 space-y-1 text-muted">{compactSchedule(row.schedule).map((entry) => <li key={entry.utcDate}>{entry.hidden ? entry.utcDate : `${entry.utcDate}: ${entry.freeBadges} badge${entry.freeBadges === 1 ? "" : "s"}`}</li>)}</ul></details> : null}</div>)}
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">Totals are calculated per universe before being added. Unused free slots cannot move to another universe.</div>
          </>}
        </div>
      </section>

      <details className="panel p-6" open>
        <summary className="cursor-pointer text-xl font-semibold text-foreground">Check the AwardBadgeAsync call budget</summary>
        <p className="mt-2 text-sm leading-6 text-muted">This is separate from creation cost. Roblox publishes a calls-per-minute formula of 50 + 35 × users.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-foreground">Users in the formula<input value={awardUsers} onChange={(event) => setAwardUsers(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-foreground">Planned calls per minute<input value={plannedCalls} onChange={(event) => setPlannedCalls(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label></div>
          {!award.result ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">{award.errors.join(" ")}</div> : <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-lg border border-accent/40 bg-accent/5 p-4"><p className="text-sm text-muted">Published ceiling</p><p className="mt-1 text-2xl font-semibold text-foreground">{award.result.ceiling.toLocaleString("en-US")}/min</p></div><div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Headroom</p><p className="mt-1 text-2xl font-semibold text-foreground">{award.result.headroom.toLocaleString("en-US")}</p></div><div className={`rounded-lg border p-4 ${award.result.overage ? "border-amber-500/30 bg-amber-500/10" : "border-border/60 bg-surface"}`}><p className="text-sm text-muted">Overage</p><p className="mt-1 text-2xl font-semibold text-foreground">{award.result.overage.toLocaleString("en-US")}</p></div></div>}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">Budget room does not guarantee an award. The player must be connected, not already own the badge, and the enabled badge must be awarded by server-side code from its associated experience. Roblox does not clearly state a broader aggregation scope for this formula.</p>
      </details>

      <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Rules verified {BADGE_RULES_VERIFIED_DATE}: {FREE_BADGES_PER_UTC_DAY} free creations per universe per UTC day, then {PAID_BADGE_CREATION_COST} Robux each. The planner cannot create badges, spend Robux, review icons, or award badges.</div>
      <a href="https://create.roblox.com/docs/production/publishing/badges" target="_blank" rel="noreferrer" onClick={() => trackEvent("tool_source_click", { tool_code: "roblox-badge-cost-quota-planner" })} className="inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline">Check Roblox&apos;s current badge publishing guide</a>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  addCreatorRewardHoldDays,
  calculateAudienceExpansionReward,
  calculateDailyCreatorReward,
  CREATOR_REWARDS_AUDIENCE_SHARE_PERCENT,
  CREATOR_REWARDS_DAILY_RATE,
  CREATOR_REWARDS_HOLD_DAYS,
  CREATOR_REWARDS_VERIFIED_DATE,
  formatCents,
  formatHundredths,
  type AudienceUserType,
  type DailyRewardMode
} from "@/lib/roblox-platform-tools/creator-rewards-estimator";

type Section = "daily" | "audience";
type CohortRow = { id: number; type: AudienceUserType; users: string; base: string };

function parseDashboardHundredths(value: string): bigint | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

export function CreatorRewardsEstimatorClient() {
  const [section, setSection] = useState<Section>("daily");
  const [dailyMode, setDailyMode] = useState<DailyRewardMode>("single-total");
  const [eventsInput, setEventsInput] = useState("17");
  const [daysInput, setDaysInput] = useState("30");
  const [dailyDate, setDailyDate] = useState("");
  const [cohorts, setCohorts] = useState<CohortRow[]>([{ id: 1, type: "new", users: "1", base: "100" }]);
  const [nextCohortId, setNextCohortId] = useState(2);
  const [audienceDate, setAudienceDate] = useState("");
  const [dashboardRobuxInput, setDashboardRobuxInput] = useState("");

  const daily = useMemo(() => calculateDailyCreatorReward({ mode: dailyMode, eventsInput, daysInput }), [dailyMode, eventsInput, daysInput]);
  const audience = useMemo(() => calculateAudienceExpansionReward(cohorts.map((row) => ({ type: row.type, usersInput: row.users, eligibleBaseInput: row.base }))), [cohorts]);
  const dailyValidationDate = dailyDate ? addCreatorRewardHoldDays(dailyDate) : null;
  const audienceValidationDate = audienceDate ? addCreatorRewardHoldDays(audienceDate) : null;
  const dashboardHundredths = dashboardRobuxInput.trim() ? parseDashboardHundredths(dashboardRobuxInput) : null;
  const combinedDashboardCompatible = daily.result && dashboardHundredths !== null
    ? daily.result.rewardHundredths + dashboardHundredths
    : null;

  function chooseSection(next: Section) {
    setSection(next);
    trackEvent("calculator_mode_change", { tool_code: "roblox-creator-rewards-estimator", section: next });
  }

  function updateCohort(id: number, field: "type" | "users" | "base", value: string) {
    setCohorts((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function addCohort() {
    setCohorts((current) => [...current, { id: nextCohortId, type: "reactivated", users: "1", base: "0" }]);
    setNextCohortId((value) => value + 1);
  }

  return (
    <div className="tool-surface space-y-6">
      <div className="inline-flex overflow-hidden rounded-md border border-border/70 bg-surface text-sm font-semibold shadow-soft">
        <button type="button" onClick={() => chooseSection("daily")} className={`px-4 py-2 transition ${section === "daily" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}>Daily Engagement</button>
        <button type="button" onClick={() => chooseSection("audience")} className={`px-4 py-2 transition ${section === "audience" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}>Audience Expansion</button>
      </div>

      {section === "daily" ? (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="panel space-y-5 p-6">
            <div><h2 className="text-xl font-semibold text-foreground">Qualified Daily Engagement events</h2><p className="mt-2 text-sm leading-6 text-muted">Use already-qualified rewarded active-spender days from Creator Dashboard. Raw visits or ten-minute sessions are not enough.</p></div>
            <div className="inline-flex rounded-md border border-border/70 text-sm font-semibold">
              <button type="button" onClick={() => setDailyMode("single-total")} className={`rounded-l-md px-3 py-2 ${dailyMode === "single-total" ? "bg-accent text-white" : "text-foreground"}`}>Single total</button>
              <button type="button" onClick={() => setDailyMode("daily-average")} className={`rounded-r-md px-3 py-2 ${dailyMode === "daily-average" ? "bg-accent text-white" : "text-foreground"}`}>Daily average</button>
            </div>
            <label className="block text-sm font-semibold text-foreground">{dailyMode === "single-total" ? "Qualified rewarded active-spender days" : "Average qualified events per day"}<input value={eventsInput} onChange={(event) => setEventsInput(event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label>
            {dailyMode === "daily-average" ? <label className="block text-sm font-semibold text-foreground">Number of days<input value={daysInput} onChange={(event) => setDaysInput(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label> : null}
            <label className="block text-sm font-semibold text-foreground">First earning date, optional<input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label>
            <p className="text-xs leading-5 text-muted">Rate verified {CREATOR_REWARDS_VERIFIED_DATE}: {CREATOR_REWARDS_DAILY_RATE} Robux per already-qualified user-day event.</p>
          </div>
          <div className="panel space-y-5 p-6" aria-live="polite">
            {!daily.result ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"><ul className="list-disc space-y-1 pl-5">{daily.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : <>
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-5"><p className="text-sm font-medium text-muted">Estimated Daily Engagement reward</p><p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{formatHundredths(daily.result.rewardHundredths)} Robux</p><p className="mt-2 text-sm text-muted">{formatHundredths(daily.result.plannedEventsHundredths)} qualified user-day events at {CREATOR_REWARDS_DAILY_RATE} Robux each.</p></div>
              {daily.result.isScenario ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">A fractional daily average makes this a planning scenario. Roblox awards from actual whole qualifying user-day events.</div> : null}
              {dailyValidationDate ? <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Nominal 60-day validation date for the first event</p><p className="mt-1 text-xl font-semibold text-foreground">{dailyValidationDate}</p><p className="mt-2 text-xs leading-5 text-muted">This is a calendar projection, not a promised release date.</p></div> : null}
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">The count must already satisfy Active Spender status, ten accumulated minutes, the user&apos;s local day, and Roblox&apos;s first-three qualifying-experiences rule. This tool cannot verify those conditions.</div>
            </>}
          </div>
        </section>
      ) : (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="panel space-y-5 p-6">
            <div><h2 className="text-xl font-semibold text-foreground">Qualified Audience Expansion cohorts</h2><p className="mt-2 text-sm leading-6 text-muted">Enter only users Roblox already attributed and purchase bases already capped and adjusted per person.</p></div>
            <div className="space-y-3">{cohorts.map((row, index) => <div key={row.id} className="rounded-lg border border-border/60 bg-surface p-4"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold text-foreground">User type<select value={row.type} onChange={(event) => updateCohort(row.id, "type", event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal"><option value="new">New users</option><option value="reactivated">Reactivated users</option></select></label><label className="text-sm font-semibold text-foreground">Qualified users<input aria-label={`Cohort ${index + 1} qualified users`} value={row.users} onChange={(event) => updateCohort(row.id, "users", event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-foreground">Eligible base, USD<input aria-label={`Cohort ${index + 1} eligible base`} value={row.base} onChange={(event) => updateCohort(row.id, "base", event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label></div>{cohorts.length > 1 ? <button type="button" onClick={() => setCohorts((current) => current.filter((entry) => entry.id !== row.id))} className="mt-3 text-xs font-semibold text-muted hover:text-foreground">Remove cohort</button> : null}</div>)}</div>
            <button type="button" onClick={addCohort} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground">Add cohort</button>
            <p className="text-xs leading-5 text-muted">The eligible purchase base must be no more than $100 per qualified user. For reactivated users, enter the remaining base after prior-reactivation deductions.</p>
            <label className="block text-sm font-semibold text-foreground">Qualifying purchase date, optional<input type="date" value={audienceDate} onChange={(event) => setAudienceDate(event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label>
            <label className="block text-sm font-semibold text-foreground">Creator Dashboard estimated payout, optional Robux<input value={dashboardRobuxInput} onChange={(event) => setDashboardRobuxInput(event.target.value)} inputMode="decimal" placeholder="For a dashboard-based combined total" className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" /></label>
          </div>
          <div className="panel space-y-5 p-6" aria-live="polite">
            {!audience.result ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"><ul className="list-disc space-y-1 pl-5">{audience.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : <>
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-5"><p className="text-sm font-medium text-muted">Published {CREATOR_REWARDS_AUDIENCE_SHARE_PERCENT}% USD-equivalent share</p><p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{formatCents(audience.result.displayedShareCents)}</p><p className="mt-2 text-sm text-muted">From {formatCents(audience.result.totalBaseCents)} of already-qualified, capped original purchase value.</p></div>
              <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Theoretical Robux at the standard $0.0038 DevEx rate</p><p className="mt-1 text-2xl font-semibold text-foreground">≈ {formatHundredths(audience.result.theoreticalRobuxHundredths)} Robux</p><p className="mt-2 text-xs leading-5 text-muted">Planning bridge only. Roblox does not publish this as the Creator Rewards settlement formula or a whole-Robux rounding rule.</p></div>
              {combinedDashboardCompatible !== null ? <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Daily estimate plus dashboard-entered Audience Expansion estimate</p><p className="mt-1 text-2xl font-semibold text-foreground">{formatHundredths(combinedDashboardCompatible)} Robux</p><p className="mt-2 text-xs text-muted">This combined value uses your Creator Dashboard Robux number, not the theoretical conversion above.</p></div> : dashboardRobuxInput.trim() ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">Enter the dashboard estimate as a non-negative Robux amount with at most two decimals.</div> : null}
              {audienceValidationDate ? <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Nominal {CREATOR_REWARDS_HOLD_DAYS}-day validation date</p><p className="mt-1 text-xl font-semibold text-foreground">{audienceValidationDate}</p><p className="mt-2 text-xs text-muted">Reversals, duplicate checks, and account review can change timing or value.</p></div> : null}
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">The tool cannot verify attribution, duplicate status, the 100 average DAU condition, creator eligibility, reactivation deductions, reversals, or anti-abuse adjustments. Creator Dashboard is authoritative.</div>
            </>}
          </div>
        </section>
      )}

      <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Do not use bots, alternate accounts, misleading links, automated activity, or artificial spend to manufacture rewards. Program constants were verified {CREATOR_REWARDS_VERIFIED_DATE} and can change.</div>
      <a href="https://create.roblox.com/docs/creator-rewards" target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline">Check the current Roblox Creator Rewards framework</a>
    </div>
  );
}

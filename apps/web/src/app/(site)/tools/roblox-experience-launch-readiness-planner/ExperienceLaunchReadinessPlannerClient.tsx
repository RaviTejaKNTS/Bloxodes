"use client";

import { useEffect, useMemo, useState } from "react";

import { buildLaunchPlainText, createLaunchChecklistExport, DEFAULT_LAUNCH_PROFILE, LAUNCH_RULES_VERIFIED_DATE, summarizeLaunchReadiness, type LaunchItemGroup, type LaunchProfile } from "@/lib/roblox-platform-tools/experience-launch-readiness-planner";

const STORAGE_KEY = "bloxodes:roblox-launch-readiness:v1";
const GROUPS: LaunchItemGroup[] = ["Publication and policy", "Store page and audience", "Gameplay and reliability", "Performance and operations"];

function ProfileToggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-surface p-4"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" /><span><span className="block text-sm font-semibold text-foreground">{label}</span><span className="mt-1 block text-xs leading-5 text-muted">{help}</span></span></label>;
}

export function ExperienceLaunchReadinessPlannerClient() {
  const [profile, setProfile] = useState<LaunchProfile>(DEFAULT_LAUNCH_PROFILE);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { profile?: LaunchProfile; completed?: Record<string, boolean> };
        if (parsed.profile) setProfile({ ...DEFAULT_LAUNCH_PROFILE, ...parsed.profile });
        if (parsed.completed && typeof parsed.completed === "object") setCompleted(parsed.completed);
      }
    } catch { /* Ignore malformed local state. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, completed }));
  }, [profile, completed, hydrated]);

  const summary = useMemo(() => summarizeLaunchReadiness(profile, completed), [profile, completed]);

  function updateProfile<K extends keyof LaunchProfile>(key: K, value: LaunchProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function exportJson() {
    const payload = createLaunchChecklistExport(profile, completed, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "roblox-launch-readiness.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Exported the active checklist as JSON.");
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildLaunchPlainText(profile, completed));
      setMessage("Copied the unresolved launch summary.");
    } catch { setMessage("Clipboard access was unavailable. Use JSON export instead."); }
  }

  function reset() {
    if (!window.confirm("Clear this browser's launch profile and checklist progress?")) return;
    setProfile(DEFAULT_LAUNCH_PROFILE);
    setCompleted({});
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage("Local launch progress was cleared.");
  }

  const statusCopy = summary.status === "blocked" ? "Launch blockers remain" : summary.status === "blockers-clear" ? "Publication blockers are clear" : "Active checklist complete";

  return <div className="tool-surface space-y-8">
    <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Choose the launch profile</h2><p className="mt-2 text-sm leading-6 text-muted">Current reach rules are dated and can change. Use the option that Creator Dashboard shows for the audience you intend to reach.</p><fieldset className="mt-6"><legend className="text-sm font-semibold text-foreground">Intended reach</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="flex cursor-pointer gap-3 rounded-lg border border-border/60 bg-surface p-4"><input type="radio" name="reach" checked={profile.reach === "16plus"} onChange={() => updateProfile("reach", "16plus")} /><span><span className="block font-semibold text-foreground">16+ and Trusted Friends</span><span className="mt-1 block text-xs leading-5 text-muted">Uses the baseline Public/Limited reach requirements.</span></span></label><label className="flex cursor-pointer gap-3 rounded-lg border border-border/60 bg-surface p-4"><input type="radio" name="reach" checked={profile.reach === "allAges"} onChange={() => updateProfile("reach", "allAges")} /><span><span className="block font-semibold text-foreground">All ages including Kids/Select</span><span className="mt-1 block text-xs leading-5 text-muted">Adds identity, 2FA, publishing-path, and evaluation blockers.</span></span></label></div></fieldset><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><ProfileToggle label="Group-owned experience" help="Keeps permission ownership prominent in the plan." checked={profile.groupOwned} onChange={(value) => updateProfile("groupOwned", value)} /><ProfileToggle label="Visible player-entered text" help="Adds the required text-filtering blocker." checked={profile.visiblePlayerText} onChange={(value) => updateProfile("visiblePlayerText", value)} /><ProfileToggle label="Purchases or paid access" help="Adds receipt and entitlement testing." checked={profile.purchases} onChange={(value) => updateProfile("purchases", value)} /><ProfileToggle label="Mobile enabled" help="Adds touch, orientation, UI, and device testing." checked={profile.mobile} onChange={(value) => updateProfile("mobile", value)} /><ProfileToggle label="Console/gamepad enabled" help="Adds controller navigation and platform checks." checked={profile.console} onChange={(value) => updateProfile("console", value)} /></div></section>

    <section className={`rounded-lg border p-6 ${summary.status === "blocked" ? "border-red-500/30 bg-red-500/10" : summary.status === "blockers-clear" ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold uppercase tracking-wide text-muted">Current status</p><h2 className="mt-1 text-2xl font-semibold text-foreground">{statusCopy}</h2><p className="mt-2 text-sm leading-6 text-foreground">A checked blocker is your own confirmation. It is not proof sent to Roblox.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-md border border-current/15 bg-background/60 px-4 py-3 text-center"><p className="text-2xl font-semibold text-foreground">{summary.completedBlockers}/{summary.blockers.length}</p><p className="text-xs text-muted">blockers complete</p></div><div className="rounded-md border border-current/15 bg-background/60 px-4 py-3 text-center"><p className="text-2xl font-semibold text-foreground">{summary.completedRecommended}/{summary.recommended.length}</p><p className="text-xs text-muted">recommended complete</p></div></div></div></section>

    {GROUPS.map((group) => {
      const items = summary.active.filter((item) => item.group === group);
      if (!items.length) return null;
      return <section key={group} className="panel p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-foreground">{group}</h2><p className="text-xs text-muted">{items.filter((item) => completed[item.id]).length}/{items.length} complete</p></div><div className="mt-5 space-y-3">{items.map((item) => <label key={item.id} className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 ${completed[item.id] ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/60 bg-surface"}`}><input type="checkbox" checked={completed[item.id] === true} onChange={(event) => { setCompleted((current) => ({ ...current, [item.id]: event.target.checked })); setMessage(""); }} className="mt-1" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{item.title}</span><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${item.severity === "blocker" ? "border-red-500/30 text-red-800 dark:text-red-200" : "border-border text-muted"}`}>{item.severity}</span></span><span className="mt-1 block text-sm leading-6 text-muted">{item.rationale}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-2 inline-block text-xs font-semibold text-accent underline-offset-4 hover:underline">Roblox source</a></span></label>)}</div></section>;
    })}

    <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Handoff and local state</h2><p className="mt-2 text-sm leading-6 text-muted">This profile and checklist stay in localStorage in this browser. No checklist value is sent to Bloxodes, Roblox, an API route, analytics, or storage.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void copySummary()} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">Copy unresolved summary</button><button type="button" onClick={exportJson} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground">Export JSON</button><button type="button" onClick={reset} className="rounded-md border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300">Reset local progress</button></div>{message ? <p className="mt-4 text-sm font-semibold text-foreground" role="status">{message}</p> : null}</section>

    <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Rules checked {LAUNCH_RULES_VERIFIED_DATE}. The planner cannot inspect account eligibility, permissions, questionnaires, moderation, assets, code, saves, purchases, devices, performance, or analytics.</div>
    <a href="https://create.roblox.com/docs/production/publishing/publish-games-and-places" target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">Roblox publishing requirements</a>
  </div>;
}

"use client";

import { useMemo, useState } from "react";

import { calculateServerMemoryCapacity, SERVER_MEMORY_RULES_VERIFIED_DATE } from "@/lib/roblox-platform-tools/server-memory-capacity-planner";

function NumberField({ label, value, onChange, help, min = 0, max, step = "any" }: { label: string; value: string; onChange: (value: string) => void; help?: string; min?: number; max?: number; step?: string }) {
  return <label className="block"><span className="text-sm font-semibold text-foreground">{label}</span>{help ? <span className="mt-1 block text-xs leading-5 text-muted">{help}</span> : null}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" /></label>;
}

function gib(value: number) { return `${value.toFixed(3)} GiB`; }

export function ServerMemoryCapacityPlannerClient() {
  const [maxPlayers, setMaxPlayers] = useState("50");
  const [targetPlayers, setTargetPlayers] = useState("20");
  const [lowSamplePlayers, setLowSamplePlayers] = useState("0");
  const [lowSampleMemoryGiB, setLowSampleMemoryGiB] = useState("1");
  const [highSamplePlayers, setHighSamplePlayers] = useState("20");
  const [highSampleMemoryGiB, setHighSampleMemoryGiB] = useState("3");
  const [eventReserveGiB, setEventReserveGiB] = useState("0.5");
  const [growthMiBPerHour, setGrowthMiBPerHour] = useState("256");
  const [plannedUptimeHours, setPlannedUptimeHours] = useState("2");
  const [safetyPercent, setSafetyPercent] = useState("50");
  const [measuredHeartbeat, setMeasuredHeartbeat] = useState("60");

  const calculation = useMemo(() => calculateServerMemoryCapacity({ maxPlayers, targetPlayers, lowSamplePlayers, lowSampleMemoryGiB, highSamplePlayers, highSampleMemoryGiB, eventReserveGiB, growthMiBPerHour, plannedUptimeHours, safetyPercent, measuredHeartbeat }), [maxPlayers, targetPlayers, lowSamplePlayers, lowSampleMemoryGiB, highSamplePlayers, highSampleMemoryGiB, eventReserveGiB, growthMiBPerHour, plannedUptimeHours, safetyPercent, measuredHeartbeat]);
  const result = calculation.result;

  return <div className="tool-surface space-y-8">
    <section className="panel p-6"><div><h2 className="text-xl font-semibold text-foreground">Set the player target</h2><p className="mt-2 text-sm leading-6 text-muted">MaxPlayers is your configured place setting. The target is the largest connected count you want to evaluate.</p></div><div className="mt-6 grid gap-5 sm:grid-cols-3"><NumberField label="Configured MaxPlayers" value={maxPlayers} onChange={setMaxPlayers} min={1} max={1000} step="1" /><NumberField label="Target connected players" value={targetPlayers} onChange={setTargetPlayers} min={1} max={1000} step="1" /><NumberField label="Memory safety target (%)" value={safetyPercent} onChange={setSafetyPercent} min={1} max={50} help="50% is Roblox's current recommendation" /></div></section>

    <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Enter two measured server samples</h2><p className="mt-2 text-sm leading-6 text-muted">Use total server memory from comparable test or live sessions. The player counts must differ.</p><div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-lg border border-border/60 bg-surface p-5"><h3 className="font-semibold text-foreground">Sample A</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Connected players" value={lowSamplePlayers} onChange={setLowSamplePlayers} max={1000} step="1" /><NumberField label="Memory used (GiB)" value={lowSampleMemoryGiB} onChange={setLowSampleMemoryGiB} max={100} /></div></div><div className="rounded-lg border border-border/60 bg-surface p-5"><h3 className="font-semibold text-foreground">Sample B</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Connected players" value={highSamplePlayers} onChange={setHighSamplePlayers} max={1000} step="1" /><NumberField label="Memory used (GiB)" value={highSampleMemoryGiB} onChange={setHighSampleMemoryGiB} max={100} /></div></div></div></section>

    <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Add reserves and a compute check</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Event reserve (GiB)" value={eventReserveGiB} onChange={setEventReserveGiB} max={100} /><NumberField label="Observed growth (MiB/hour)" value={growthMiBPerHour} onChange={setGrowthMiBPerHour} max={100000} /><NumberField label="Planned uptime (hours)" value={plannedUptimeHours} onChange={setPlannedUptimeHours} max={168} /><NumberField label="Measured heartbeat (steps/sec)" value={measuredHeartbeat} onChange={setMeasuredHeartbeat} max={60} help="60 is the documented cap" /></div>{calculation.errors.length ? <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-200"><ul className="list-disc space-y-1 pl-5">{calculation.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}</section>

    {result ? <>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-5"><p className="text-sm text-muted">Projected memory</p><p className="mt-2 text-3xl font-semibold text-foreground">{gib(result.projectedUsedGiB)}</p><p className="mt-2 text-xs text-muted">{result.usagePercent.toFixed(1)}% of allocated total</p></div>
        <div className="panel p-5"><p className="text-sm text-muted">Roblox total allocation</p><p className="mt-2 text-3xl font-semibold text-foreground">{gib(result.allocatedTotalGiB)}</p><p className="mt-2 text-xs text-muted">At the {result.targetPlayers}-player high-water mark</p></div>
        <div className="panel p-5"><p className="text-sm text-muted">{result.safetyPercent}% safety ceiling</p><p className="mt-2 text-3xl font-semibold text-foreground">{gib(result.safetyCeilingGiB)}</p><p className={`mt-2 text-xs font-semibold ${result.memoryStatus === "pass" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{result.memoryStatus === "pass" ? `${gib(result.remainingGiB)} headroom` : `${gib(Math.abs(result.remainingGiB))} over target`}</p></div>
        <div className="panel p-5"><p className="text-sm text-muted">Memory-only capacity</p><p className="mt-2 text-3xl font-semibold text-foreground">{result.memoryOnlyCapacity.toLocaleString("en-US")} players</p><p className="mt-2 text-xs text-muted">Capped by entered MaxPlayers; not an overall capacity promise</p></div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2"><div className={`rounded-lg border p-5 ${result.memoryStatus === "pass" ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}><h2 className="text-lg font-semibold text-foreground">Memory gate: {result.memoryStatus === "pass" ? "within target" : "over target"}</h2><p className="mt-2 text-sm leading-6 text-foreground">Observed slope: <strong>{result.marginalGiBPerPlayer.toFixed(4)} GiB/player</strong>. Derived baseline: <strong>{gib(result.baselineGiB)}</strong>. Reserves add {gib(result.eventReserveGiB + result.longSessionReserveGiB)}.</p>{result.targetExceedsMemoryCapacity ? <p className="mt-3 text-sm font-semibold text-red-800 dark:text-red-200">The target exceeds the memory-only capacity estimate.</p> : null}</div><div className={`rounded-lg border p-5 ${result.heartbeatStatus === "pass" ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}><h2 className="text-lg font-semibold text-foreground">Heartbeat gate: {result.heartbeatStatus === "pass" ? "at 60 steps/sec" : "needs investigation"}</h2><p className="mt-2 text-sm leading-6 text-foreground">Measured heartbeat is <strong>{result.measuredHeartbeat.toFixed(1)} steps/sec</strong>. Roblox says values below the 60-step cap might indicate a server compute problem. Memory headroom does not resolve slow CPU, physics, scripts, or networking.</p></div></section>

      <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Projection breakdown</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-border/60 bg-surface p-4"><dt className="text-sm text-muted">Player-based projection</dt><dd className="mt-1 font-semibold text-foreground">{gib(result.baselineGiB + result.marginalGiBPerPlayer * result.targetPlayers)}</dd></div><div className="rounded-lg border border-border/60 bg-surface p-4"><dt className="text-sm text-muted">Event reserve</dt><dd className="mt-1 font-semibold text-foreground">{gib(result.eventReserveGiB)}</dd></div><div className="rounded-lg border border-border/60 bg-surface p-4"><dt className="text-sm text-muted">Long-session reserve</dt><dd className="mt-1 font-semibold text-foreground">{gib(result.longSessionReserveGiB)}</dd></div><div className="rounded-lg border border-border/60 bg-surface p-4"><dt className="text-sm text-muted">Samples normalized</dt><dd className="mt-1 font-semibold text-foreground">{result.lowSample.players} players / {gib(result.lowSample.memoryGiB)} → {result.highSample.players} players / {gib(result.highSample.memoryGiB)}</dd></div></dl></section>
    </> : null}

    <section className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-5"><h2 className="font-semibold text-foreground">Validate before changing MaxPlayers</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground"><li>Repeat samples after representative maps, characters, physics, and server systems load.</li><li>Run long enough to expose memory growth; inspect LuaHeap, InstanceCount, and PlaceScriptMemory.</li><li>Check Server Jobs and MicroProfiler for heartbeat frames over 16.67 ms.</li><li>Review Performance Dashboard and server out-of-memory snapshots after releases.</li></ul></section>
    <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Rules checked {SERVER_MEMORY_RULES_VERIFIED_DATE}. The result does not model CPU, network, physics, DataStore traffic, client device limits, matchmaking, or gameplay-space capacity.</div>
    <a href="https://create.roblox.com/docs/performance-optimization/identify" target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">Roblox performance guidance</a>
  </div>;
}

"use client";

import { useMemo, useState } from "react";

import { calculateDataStoreBudget, DATASTORE_LIMITS_VERIFIED_DATE, type DataStoreOperationInputs } from "@/lib/roblox-platform-tools/datastore-budget-calculator";

const OPERATION_FIELDS: { key: keyof DataStoreOperationInputs; label: string; help: string }[] = [
  { key: "standardGets", label: "Standard gets", help: "GetAsync and version reads" },
  { key: "standardWrites", label: "Standard sets / increments", help: "SetAsync and IncrementAsync" },
  { key: "standardUpdates", label: "Standard updates", help: "Counts once as read and once as write" },
  { key: "standardLists", label: "Standard list pages", help: "List stores, keys, or versions" },
  { key: "standardRemoves", label: "Standard removes", help: "RemoveAsync" },
  { key: "orderedReads", label: "Ordered keys read", help: "Count BatchGetAsync keys, not calls" },
  { key: "orderedWrites", label: "Ordered sets / increments", help: "SetAsync and IncrementAsync" },
  { key: "orderedUpdates", label: "Ordered updates", help: "Counts once as read and once as write" },
  { key: "orderedLists", label: "Ordered sorted pages", help: "GetSortedAsync page requests" },
  { key: "orderedRemoves", label: "Ordered removes", help: "RemoveAsync" }
];

const initialOperations: DataStoreOperationInputs = { standardGets: "40", standardWrites: "10", standardUpdates: "5", standardLists: "0", standardRemoves: "0", orderedReads: "0", orderedWrites: "0", orderedUpdates: "0", orderedLists: "1", orderedRemoves: "0" };

function statusClass(status: "pass" | "warn" | "fail") {
  if (status === "pass") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
  if (status === "warn") return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  return "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200";
}

function NumberField({ label, value, onChange, help, min = 0, max }: { label: string; value: string; onChange: (value: string) => void; help?: string; min?: number; max?: number }) {
  return <label className="block"><span className="text-sm font-semibold text-foreground">{label}</span>{help ? <span className="mt-1 block text-xs leading-5 text-muted">{help}</span> : null}<input type="number" min={min} max={max} step="1" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" /></label>;
}

export function DataStoreBudgetCalculatorClient() {
  const [players, setPlayers] = useState("10");
  const [concurrentUsers, setConcurrentUsers] = useState("100");
  const [serverCount, setServerCount] = useState("10");
  const [safetyPercent, setSafetyPercent] = useState("80");
  const [averageReadBytes, setAverageReadBytes] = useState("0");
  const [averageWriteBytes, setAverageWriteBytes] = useState("0");
  const [operations, setOperations] = useState(initialOperations);

  const calculation = useMemo(() => calculateDataStoreBudget({ players, concurrentUsers, serverCount, safetyPercent, averageReadBytes, averageWriteBytes, operations }), [players, concurrentUsers, serverCount, safetyPercent, averageReadBytes, averageWriteBytes, operations]);
  const result = calculation.result;

  return <div className="tool-surface space-y-8">
    <section className="panel p-6">
      <div><h2 className="text-xl font-semibold text-foreground">Describe the server and experience</h2><p className="mt-2 text-sm leading-6 text-muted">All operation inputs are requests per minute for one representative game server. The calculator multiplies them across similar servers for the experience check.</p></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Players in this server" value={players} onChange={setPlayers} max={1000} />
        <NumberField label="Total experience CCU" value={concurrentUsers} onChange={setConcurrentUsers} max={10000000} help="Across every live server" />
        <NumberField label="Similar servers" value={serverCount} onChange={setServerCount} min={1} max={100000} />
        <NumberField label="Safety target (%)" value={safetyPercent} onChange={setSafetyPercent} min={1} max={100} />
      </div>
    </section>

    <section className="panel p-6">
      <h2 className="text-xl font-semibold text-foreground">Plan one server's requests per minute</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{OPERATION_FIELDS.map((field) => <NumberField key={field.key} label={field.label} help={field.help} value={operations[field.key]} onChange={(value) => setOperations((current) => ({ ...current, [field.key]: value }))} max={1000000} />)}</div>
      {calculation.errors.length ? <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-200"><ul className="list-disc space-y-1 pl-5">{calculation.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    </section>

    {result ? <>
      {result.concurrentUsersCorrected ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">Total experience CCU cannot be lower than players in this server. Experience formulas use {result.effectiveConcurrentUsers.toLocaleString("en-US")} CCU for this result.</div> : null}
      {result.hasUpdates ? <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-foreground"><strong>UpdateAsync is counted twice:</strong> every update appears in the matching read row and write row.</div> : null}
      <section className="panel overflow-hidden">
        <div className="p-6"><h2 className="text-xl font-semibold text-foreground">Budget comparison</h2><p className="mt-2 text-sm leading-6 text-muted">Pass stays within your {result.safetyPercent}% target. Warn stays within the published limit but crosses the target. Fail crosses at least one published request-count limit.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-t border-border text-sm"><thead className="bg-surface text-left text-muted"><tr><th className="px-4 py-3">Bucket</th><th className="px-4 py-3">One server</th><th className="px-4 py-3">Server limit</th><th className="px-4 py-3">Fleet demand</th><th className="px-4 py-3">Experience limit</th><th className="px-4 py-3">Tighter layer</th><th className="px-4 py-3">Result</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.bucket} className="border-t border-border/60"><td className="px-4 py-3 font-semibold text-foreground">{row.label}</td><td className="px-4 py-3 text-foreground">{row.serverDemand.toLocaleString("en-US")} <span className="text-xs text-muted">({(row.serverUtilization * 100).toFixed(1)}%)</span></td><td className="px-4 py-3 text-foreground">{row.serverLimit.toLocaleString("en-US")} <span className="text-xs text-muted">safe {row.serverSafetyLimit.toLocaleString("en-US")}</span></td><td className="px-4 py-3 text-foreground">{row.experienceDemand.toLocaleString("en-US")} <span className="text-xs text-muted">({(row.experienceUtilization * 100).toFixed(1)}%)</span></td><td className="px-4 py-3 text-foreground">{row.experienceLimit.toLocaleString("en-US")} <span className="text-xs text-muted">safe {row.experienceSafetyLimit.toLocaleString("en-US")}</span></td><td className="px-4 py-3 capitalize text-foreground">{row.limitingLayer}</td><td className="px-4 py-3"><span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</span></td></tr>)}</tbody></table></div>
      </section>

      <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Optional hot-key throughput check</h2><p className="mt-2 text-sm leading-6 text-muted">Enter the serialized bytes transferred for repeated access to one key. Roblox rounds each request up to the next kilobyte and applies separate rolling per-key throughput limits.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><NumberField label="Average bytes per read" value={averageReadBytes} onChange={setAverageReadBytes} max={4194304} /><NumberField label="Average bytes per write" value={averageWriteBytes} onChange={setAverageWriteBytes} max={4194304} /></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{([ ["Read", result.perKeyRead], ["Write", result.perKeyWrite] ] as const).map(([label, helper]) => <div key={label} className="rounded-lg border border-border/60 bg-surface p-4"><h3 className="font-semibold text-foreground">{label} key</h3>{helper ? <p className="mt-2 text-sm leading-6 text-foreground">{helper.bytes.toLocaleString("en-US")} bytes rounds to {helper.roundedKilobytes.toLocaleString("en-US")} KB. The separate {helper.limitKilobytes.toLocaleString("en-US")} KB/minute boundary is about <strong>{helper.estimatedRequestsPerMinute.toLocaleString("en-US")} requests/minute</strong> for one key.</p> : <p className="mt-2 text-sm text-muted">Enter a byte size to calculate this separate boundary.</p>}</div>)}</div><p className="mt-4 text-xs leading-5 text-muted">This helper uses decimal kilobytes as a conservative interpretation of the documentation's KB wording. It does not increase request budgets or account for partition throttling.</p></section>

      <section className="panel p-6"><h2 className="text-xl font-semibold text-foreground">Check the live server before a burst</h2><pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-950 p-4 text-xs leading-6 text-neutral-100"><code>{`local DataStoreService = game:GetService("DataStoreService")\n\nfor _, requestType in Enum.DataStoreRequestType:GetEnumItems() do\n    local available = DataStoreService:GetRequestBudgetForRequestType(requestType)\n    print(requestType.Name, available)\nend`}</code></pre><p className="mt-4 text-sm leading-6 text-muted">The runtime value is the current available request count, not this page's per-minute estimate. Use it with backpressure, protected calls, and telemetry.</p></section>
    </> : null}

    <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Limits checked {DATASTORE_LIMITS_VERIFIED_DATE}. Startup burst size, custom rate limits, Studio Run limits, Open Cloud v1, queue timing, and backend partition behavior are not calculated.</div>
    <a href="https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits" target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">Roblox DataStore limits</a>
  </div>;
}

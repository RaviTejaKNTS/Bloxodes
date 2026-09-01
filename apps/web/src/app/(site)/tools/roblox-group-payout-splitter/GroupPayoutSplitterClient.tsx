"use client";

import { useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  allocateGroupPayout,
  GROUP_PAYOUT_MAX_RECIPIENTS,
  type GroupPayoutMode
} from "@/lib/roblox-platform-tools/group-payout-splitter";

type RecipientRow = {
  id: number;
  name: string;
  userId: string;
  percentage: string;
  weight: string;
  fixed: string;
};

const MODE_COPY: Record<GroupPayoutMode, { label: string; valueLabel: string; help: string }> = {
  percentage: { label: "Percentage", valueLabel: "Share %", help: "Assign up to 100%. Any unassigned share stays in the group." },
  weight: { label: "Weight", valueLabel: "Weight", help: "Divide the entire pool by contribution units such as points or hours." },
  fixed: { label: "Fixed", valueLabel: "Robux", help: "Enter a whole-Robux amount for each person. Any remainder stays in the group." }
};

function formatRobux(value: bigint): string {
  return `${value.toLocaleString("en-US")} Robux`;
}

export function GroupPayoutSplitterClient() {
  const [mode, setMode] = useState<GroupPayoutMode>("percentage");
  const [pool, setPool] = useState("100");
  const [nextId, setNextId] = useState(4);
  const [copyStatus, setCopyStatus] = useState("");
  const [rows, setRows] = useState<RecipientRow[]>([
    { id: 1, name: "Ada", userId: "", percentage: "50", weight: "3", fixed: "50" },
    { id: 2, name: "Bo", userId: "", percentage: "30", weight: "2", fixed: "30" },
    { id: 3, name: "Cy", userId: "", percentage: "20", weight: "1", fixed: "20" }
  ]);

  const calculation = useMemo(() => allocateGroupPayout({
    poolInput: pool,
    mode,
    recipients: rows.map((row) => ({ name: row.name, userId: row.userId, value: row[mode] }))
  }), [pool, mode, rows]);
  const result = calculation.result;

  function updateRow(id: number, field: keyof Omit<RecipientRow, "id">, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function addRow() {
    if (rows.length >= GROUP_PAYOUT_MAX_RECIPIENTS) return;
    setRows((current) => [...current, {
      id: nextId,
      name: `Person ${nextId}`,
      userId: "",
      percentage: "0",
      weight: "0",
      fixed: "0"
    }]);
    setNextId((value) => value + 1);
  }

  function removeRow(id: number) {
    if (rows.length === 1) return;
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function chooseMode(nextMode: GroupPayoutMode) {
    setMode(nextMode);
    setCopyStatus("");
    trackEvent("calculator_mode_change", { tool_code: "roblox-group-payout-splitter", mode: nextMode });
  }

  async function copyPlan() {
    if (!result) return;
    const lines = [
      "Roblox group payout planning result",
      `Generated: ${new Date().toISOString()}`,
      `Mode: ${MODE_COPY[result.mode].label}`,
      `Available pool: ${result.pool} Robux`,
      ...result.allocations.map((row) => `${row.name}: ${row.allocation} Robux${row.userId ? ` (user ${row.userId})` : ""}`),
      `Total allocated: ${result.totalAllocated} Robux`,
      `Left in group: ${result.leftInGroup} Robux`,
      "Planning result only. Check group funds, permissions, and recipient eligibility in Roblox Creator Dashboard before sending."
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopyStatus("Plan copied");
    trackEvent("tool_result_copy", { tool_code: "roblox-group-payout-splitter", mode });
  }

  function downloadCsv() {
    if (!result?.csvDraft) return;
    const blob = new Blob([result.csvDraft], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roblox-group-payout-draft.csv";
    link.click();
    URL.revokeObjectURL(url);
    trackEvent("tool_result_download", { tool_code: "roblox-group-payout-splitter", format: "csv" });
  }

  return (
    <div className="tool-surface space-y-6">
      <div className="inline-flex overflow-hidden rounded-md border border-border/70 bg-surface text-sm font-semibold shadow-soft">
        {(Object.keys(MODE_COPY) as GroupPayoutMode[]).map((entry) => (
          <button key={entry} type="button" onClick={() => chooseMode(entry)} className={`px-4 py-2 transition ${mode === entry ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}>
            {MODE_COPY[entry].label}
          </button>
        ))}
      </div>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
        <div className="panel space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-end">
            <label className="block text-sm font-semibold text-foreground">
              Released group funds
              <input type="text" inputMode="numeric" value={pool} onChange={(event) => setPool(event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-base font-normal" aria-describedby="pool-help" />
            </label>
            <p id="pool-help" className="text-sm leading-6 text-muted">Enter the whole-Robux balance currently available to spend. Do not include held, pending, or forecast revenue.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-sm">
              <thead><tr className="text-muted"><th className="px-2 font-medium">Recipient</th><th className="px-2 font-medium">Roblox user ID, optional</th><th className="px-2 font-medium">{MODE_COPY[mode].valueLabel}</th><th className="px-2 font-medium"><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="bg-surface">
                    <td className="rounded-l-lg border-y border-l border-border/60 p-2"><input aria-label={`Recipient ${index + 1} name`} value={row.name} onChange={(event) => updateRow(row.id, "name", event.target.value)} className="w-full rounded-md border border-border/60 bg-background px-3 py-2" /></td>
                    <td className="border-y border-border/60 p-2"><input aria-label={`${row.name || `Recipient ${index + 1}`} Roblox user ID`} inputMode="numeric" value={row.userId} onChange={(event) => updateRow(row.id, "userId", event.target.value)} placeholder="For CSV draft" className="w-full rounded-md border border-border/60 bg-background px-3 py-2" /></td>
                    <td className="border-y border-border/60 p-2"><input aria-label={`${row.name || `Recipient ${index + 1}`} ${MODE_COPY[mode].valueLabel}`} inputMode="decimal" value={row[mode]} onChange={(event) => updateRow(row.id, mode, event.target.value)} className="w-full rounded-md border border-border/60 bg-background px-3 py-2" /></td>
                    <td className="rounded-r-lg border-y border-r border-border/60 p-2 text-right"><button type="button" onClick={() => removeRow(row.id)} disabled={rows.length === 1} className="rounded-md px-3 py-2 font-semibold text-muted hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{MODE_COPY[mode].help}</p>
            <button type="button" onClick={addRow} disabled={rows.length >= GROUP_PAYOUT_MAX_RECIPIENTS} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5">Add recipient</button>
          </div>
          <p className="text-xs text-muted">Calculator limit: {GROUP_PAYOUT_MAX_RECIPIENTS} recipients. This is not a published Roblox batch limit.</p>
        </div>

        <div className="panel space-y-5 p-6" aria-live="polite">
          {!result ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Fix the payout plan</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{calculation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-5"><p className="text-sm text-muted">Total allocated</p><p className="mt-1 text-3xl font-semibold text-foreground">{formatRobux(result.totalAllocated)}</p></div>
                <div className="rounded-lg border border-border/60 bg-surface p-5"><p className="text-sm text-muted">Left in group</p><p className="mt-1 text-3xl font-semibold text-foreground">{formatRobux(result.leftInGroup)}</p></div>
              </div>
              {result.warnings.map((warning) => <div key={warning} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">{warning}</div>)}
              <div className="space-y-2">
                {result.allocations.map((row) => (
                  <div key={`${row.name}-${row.userId ?? "none"}`} className="rounded-lg border border-border/60 bg-surface p-4">
                    <div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-foreground">{row.name}</p><p className="text-xs text-muted">Exact quota: {row.exactQuota} Robux</p></div><p className="text-lg font-semibold text-foreground">{formatRobux(row.allocation)}</p></div>
                    {row.receivedRoundingRobux ? <p className="mt-2 text-xs font-semibold text-accent">Received one rounding Robux</p> : null}
                  </div>
                ))}
              </div>
              {mode !== "fixed" ? <details className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6"><summary className="cursor-pointer font-semibold text-foreground">Why did a row get one more Robux?</summary><p className="mt-2 text-muted">This calculator floors each exact quota, then gives remaining whole Robux to the largest fractional remainders. Original row order breaks a tie. This is the calculator&apos;s planning method, not a claim about Roblox&apos;s internal rounding.</p></details> : null}
              <div className="flex flex-wrap gap-3"><button type="button" onClick={copyPlan} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Copy plan</button><button type="button" onClick={downloadCsv} disabled={!result.csvDraft} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground disabled:opacity-40">Download CSV draft</button>{copyStatus ? <span className="self-center text-sm font-semibold text-accent">{copyStatus}</span> : null}</div>
              {!result.csvDraft ? <p className="text-xs leading-5 text-muted">Add a valid Roblox user ID to every positive payout row to enable the two-column CSV draft.</p> : null}
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">Planning result only. Check group funds, the sender&apos;s <strong>Configure and spend group revenue</strong> permission, and every recipient&apos;s membership and eligibility in Creator Dashboard before sending.</div>
              <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Use payouts only as legitimate compensation for collaborative content development. The calculator cannot check payout restrictions, paid-access exceptions, agreements, or policy compliance.</div>
              <a href="https://create.roblox.com/docs/projects/groups" target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline">Check Roblox&apos;s current group payout documentation</a>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

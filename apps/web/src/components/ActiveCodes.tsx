"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { Code } from "@/lib/db";
import { cleanRewardsText, isCodeNew } from "@/lib/code-utils";
import { trackEvent } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadAccountCodeProgress,
  readLocalCodeProgress,
  saveAccountCodeProgress,
  useCodeProgressSession,
  writeLocalCodeProgress
} from "@/lib/code-progress-client";
import { CopyCodeButton } from "./CopyCodeButton";

type Props = {
  codes: Code[];
  gameName: string;
  gameSlug: string;
  lastUpdatedLabel: string;
  lastCheckedLabel: string;
  lastCheckedRelativeLabel?: string | null;
  nowMs: number;
};

type EnrichedCode = Code & {
  rewardText: string | null;
  isNew: boolean;
  addedAtLabel: string | null;
};

export function ActiveCodes({
  codes,
  gameName,
  gameSlug,
  lastUpdatedLabel,
  lastCheckedLabel,
  lastCheckedRelativeLabel,
  nowMs
}: Props) {
  const [usedCodes, setUsedCodes] = useState<Set<string>>(() => new Set());
  const [progressReady, setProgressReady] = useState(false);
  const session = useCodeProgressSession();

  useEffect(() => {
    if (session.status !== "ready") {
      setProgressReady(false);
      return;
    }

    let cancelled = false;

    async function loadProgress() {
      const localUsedCodes = readLocalCodeProgress(gameSlug, gameName);

      if (!session.userId) {
        if (cancelled) return;
        setUsedCodes(new Set(localUsedCodes));
        setProgressReady(true);
        return;
      }

      const accountUsedCodes = await loadAccountCodeProgress(gameSlug);
      if (cancelled) return;

      const mergedUsedCodes = Array.from(new Set([...accountUsedCodes, ...localUsedCodes]));
      setUsedCodes(new Set(mergedUsedCodes));
      setProgressReady(true);
    }

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, [gameName, gameSlug, session.status, session.userId]);

  useEffect(() => {
    if (!progressReady) {
      return;
    }

    const serializedCodes = Array.from(usedCodes);
    writeLocalCodeProgress(gameSlug, gameName, serializedCodes);

    if (session.userId) {
      void saveAccountCodeProgress(gameSlug, serializedCodes);
    }
  }, [gameName, gameSlug, progressReady, session.userId, usedCodes]);

  const enriched = useMemo<EnrichedCode[]>(() => {
    return codes.map((code) => {
      const rewardText = cleanRewardsText(code.rewards_text);
      const isNew = isCodeNew(code, nowMs);
      const addedAtLabel = code.first_seen_at
        ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
            new Date(code.first_seen_at)
          )
        : null;
      return { ...code, rewardText, isNew, addedAtLabel };
    });
  }, [codes, nowMs]);

  function markUsed(code: string) {
    if (usedCodes.has(code)) {
      return;
    }

    setUsedCodes((prev) => {
      const next = new Set(prev);
      next.add(code);
      return next;
    });
    trackEvent("code_mark_used", { game_slug: gameSlug, code, used: true });
  }

  function markUnused(code: string) {
    if (!usedCodes.has(code)) {
      return;
    }

    setUsedCodes((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
    trackEvent("code_mark_used", { game_slug: gameSlug, code, used: false });
  }

  return (
    <Card className="overflow-hidden rounded-lg border-border/70 bg-card shadow-none" id="active-codes">
      <CardHeader className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl leading-tight text-foreground sm:text-2xl">
              Active {gameName} Codes
            </CardTitle>
            <p className="flex items-center gap-1.5 text-sm leading-5 text-muted-foreground">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Checked and verified on {lastCheckedLabel}
                {lastCheckedRelativeLabel ? <span> ({lastCheckedRelativeLabel})</span> : null}
              </span>
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-1 text-xs">
            {codes.length} active
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-3 sm:p-4">
        {enriched.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">No active codes right now</p>
              <p>
                We have not confirmed any working codes at the moment. Check back soon for the next drop.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-md text-[11px] uppercase tracking-[0.12em]">
              Waiting for updates
            </Badge>
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
            {enriched.map((code, index) => {
              const isUsed = usedCodes.has(code.code);
              const displayReward = code.rewardText
                ? (/this code gives you/i.test(code.rewardText) ? code.rewardText : `You get ${code.rewardText}`)
                : null;
              return (
                <article
                  key={code.id}
                  className={`bg-card ${isUsed ? "opacity-70" : ""}`}
                >
                  <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted/30 text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <code
                            className={`font-mono text-base font-semibold tracking-[0.08em] sm:text-lg ${
                              isUsed ? "line-through text-muted" : "text-foreground"
                            }`}
                          >
                            {code.code}
                          </code>
                          {code.isNew ? (
                            <Badge className="rounded-md px-1.5 py-0 text-[10px] uppercase tracking-[0.12em]">
                              New
                            </Badge>
                          ) : null}
                          {code.level_requirement != null ? (
                            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">
                              Level {code.level_requirement}+
                            </Badge>
                          ) : null}
                        </div>
                        <p className={`text-sm leading-5 ${isUsed ? "line-through text-muted" : "text-muted-foreground"}`}>
                          {displayReward ?? "No reward listed yet."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 pl-10 sm:items-end sm:pl-0 sm:[&>*]:whitespace-nowrap">
                      <div className="flex flex-row items-center justify-end gap-2">
                        {isUsed ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => markUnused(code.code)}
                            className="order-1 h-8 w-8 text-muted-foreground"
                            aria-label={`Uncheck code ${code.code}`}
                            title="Uncheck code"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                        <div className="order-2">
                          <CopyCodeButton
                            code={code.code}
                            tone="accent"
                            onCopySuccess={() => markUsed(code.code)}
                            analytics={{
                              event: "copy_code",
                              params: {
                                game_slug: gameSlug,
                                code: code.code,
                                is_new: code.isNew,
                                status: "active"
                              }
                            }}
                          />
                        </div>
                      </div>
                      {code.addedAtLabel ? (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Added {code.addedAtLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

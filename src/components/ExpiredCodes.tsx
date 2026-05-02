"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  codes: string[];
  gameName: string;
  gameSlug: string;
};

const COLLAPSED_MAX_HEIGHT = 128; // ~4 rows of chips

export function ExpiredCodes({ codes, gameName, gameSlug }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...codes], [codes]);
  const showToggle = sorted.length > 4;
  const shouldCollapse = showToggle && !expanded;
  const hasCodes = sorted.length > 0;

  return (
    <Card className="overflow-hidden rounded-lg border-border/70 bg-card shadow-none">
      <CardHeader className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl leading-tight text-foreground">
              Expired {gameName} Codes
            </CardTitle>
            {hasCodes ? (
              <p className="text-sm leading-5 text-muted-foreground">These codes are expired and no longer work.</p>
            ) : null}
          </div>
          <Badge variant="outline" className="shrink-0 rounded-md px-2 py-1 text-xs">
            {sorted.length} expired
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        {showToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              trackEvent("expired_codes_toggle", { game_slug: gameSlug, expanded: next });
            }}
            className="mb-3 h-8 px-2 text-xs text-muted-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? "Show fewer expired codes" : "Show more expired codes"}
          >
            <span className="leading-none">{expanded ? "Show Less" : "Show More"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}
              aria-hidden
            />
          </Button>
        ) : null}

        {!hasCodes ? (
          <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            We haven't tracked any expired codes yet.
          </div>
        ) : (
          <div className="relative">
            <ul
              className="flex flex-wrap items-center gap-2 text-sm text-foreground transition-[max-height]"
              style={{
                maxHeight: shouldCollapse ? COLLAPSED_MAX_HEIGHT : undefined,
                overflow: shouldCollapse ? "hidden" : "visible"
              }}
              aria-expanded={showToggle ? expanded : undefined}
            >
              {sorted.map((code) => (
                <li
                  key={code}
                  className="flex items-center rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                  <code className="leading-none">{code}</code>
                </li>
              ))}
            </ul>
            {shouldCollapse ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

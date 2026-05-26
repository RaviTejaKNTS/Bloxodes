"use client";

import { useEffect, useMemo, useState } from "react";

type AnyRecord = Record<string, unknown>;
type DifficultyKey = "easy" | "medium" | "hard";

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((entry) => asNumber(entry)).filter((entry): entry is number => entry !== null) : [];
}

function coordKey(row: number, col: number) {
  return `${row},${col}`;
}

function coordFromCell(cell: number, size: number) {
  return { row: Math.floor(cell / size), col: cell % size };
}

function nextValue(current: number, max: number, step = 1) {
  return Math.min(max, current + step);
}

function WordleVisual({ payload, summary }: { payload: AnyRecord; summary: AnyRecord }) {
  const solution = (asString(payload.answer) || asString(payload.solution) || asString(summary.answer)).toUpperCase();
  const letters = solution.split("").slice(0, 5);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const [tick, setTick] = useState(0);
  const [visibleTiles, setVisibleTiles] = useState<boolean[]>(() => letters.map(() => false));
  const allVisible = visibleTiles.length > 0 && visibleTiles.every(Boolean);

  useEffect(() => {
    if (allVisible) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [allVisible]);

  function toggleTile(index: number) {
    setVisibleTiles((current) => current.map((value, tileIndex) => (tileIndex === index ? !value : value)));
  }

  function toggleAll() {
    setVisibleTiles(letters.map(() => !allVisible));
  }

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="flex justify-center gap-2" aria-label={allVisible ? `Wordle answer ${solution}` : "Wordle answer hidden"}>
        {letters.map((letter, index) => {
          const isVisible = visibleTiles[index];
          const decoy = alphabet[(tick * 11 + index * 7 + letter.charCodeAt(0)) % alphabet.length] ?? "X";
          return (
            <button
              key={`${letter}-${index}`}
              type="button"
              aria-pressed={isVisible}
              aria-label={isVisible ? `Hide tile ${index + 1}` : `Show tile ${index + 1}`}
              onClick={() => toggleTile(index)}
              className={[
                "relative flex h-16 w-16 overflow-hidden items-center justify-center rounded-md text-3xl font-bold uppercase shadow-sm transition-all duration-500 sm:h-20 sm:w-20 sm:text-4xl",
                isVisible
                  ? "scale-100 bg-[#538d4e] text-white shadow-[#538d4e]/25 ring-0"
                  : "bg-surface text-foreground ring-2 ring-border/80 shadow-black/5 dark:bg-[#121214] dark:text-foreground dark:ring-[#3a3a3c] dark:shadow-black/40"
              ].join(" ")}
            >
              <span
                className={
                  isVisible
                    ? "relative z-10 scale-100 opacity-100 blur-0 transition-all duration-500"
                    : "relative z-10 inline-block opacity-70 transition-none"
                }
              >
                {isVisible ? letter : decoy}
              </span>
              {isVisible ? <span className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-white/20" /> : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={toggleAll}
        className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
      >
        {allVisible ? "Hide answer" : "Show answer"}
      </button>
    </div>
  );
}

function ConnectionsVisual({ payload }: { payload: AnyRecord }) {
  const categories = Array.isArray(payload.categories) ? (payload.categories as AnyRecord[]) : [];
  const [revealedColors, setRevealedColors] = useState<string[]>([]);
  const colorClass: Record<string, string> = {
    yellow: "bg-[#f9df6d] text-[#1f1f1f]",
    green: "bg-[#a0c35a] text-[#1f1f1f]",
    blue: "bg-[#b0c4ef] text-[#1f1f1f]",
    purple: "bg-[#ba81c5] text-[#1f1f1f]"
  };
  const colorLabel: Record<string, string> = {
    yellow: "Yellow",
    green: "Green",
    blue: "Blue",
    purple: "Purple"
  };
  const revealed = new Set(revealedColors);
  const orderedColors = ["yellow", "green", "blue", "purple"];
  const sortedCategories = [...categories].sort((a, b) => orderedColors.indexOf(asString(a.color)) - orderedColors.indexOf(asString(b.color)));
  const positionedCards = sortedCategories.flatMap((category, categoryIndex) => {
    const color = asString(category.color);
    const title = asString(category.title);
    const cards = Array.isArray(category.cards) ? category.cards : [];

    return cards
      .map((card, cardIndex) => {
        const row = asRecord(card);
        const content = asString(row.content);
        if (!content) return null;

        return {
          color,
          content,
          fallbackPosition: categoryIndex * 4 + cardIndex,
          position: asNumber(row.position),
          title
        };
      })
      .filter((card): card is { color: string; content: string; fallbackPosition: number; position: number | null; title: string } => card !== null);
  });
  const startingCards = Array.isArray(payload.startingCards)
    ? payload.startingCards
        .map((card, index) => {
          const row = asRecord(card);
          const content = asString(row.content);
          if (!content) return null;
          return {
            color: asString(row.color),
            content,
            fallbackPosition: index,
            position: asNumber(row.position),
            title: asString(row.title)
          };
        })
        .filter((card): card is { color: string; content: string; fallbackPosition: number; position: number | null; title: string } => card !== null)
    : [];
  const originalCards = (startingCards.length ? startingCards : positionedCards).sort((a, b) => (a.position ?? a.fallbackPosition) - (b.position ?? b.fallbackPosition));
  const remainingCards = originalCards.filter((card) => !revealed.has(card.color));

  function toggleColor(color: string) {
    setRevealedColors((current) => (current.includes(color) ? current.filter((entry) => entry !== color) : [...current, color]));
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="space-y-2" aria-label="Connections answer board">
        {sortedCategories.filter((category) => revealed.has(asString(category.color))).map((category, index) => {
          const cards = Array.isArray(category.cards) ? category.cards.map((card) => asString(asRecord(card).content)).filter(Boolean) : [];
          const color = asString(category.color);
          return (
            <div
              key={`${asString(category.title)}-${index}`}
              className={`rounded-md px-4 py-4 text-center transition-all duration-500 animate-in fade-in zoom-in-95 slide-in-from-top-2 ${colorClass[color] ?? "bg-surface text-foreground"}`}
            >
              <p className="text-sm font-extrabold uppercase tracking-wide">{asString(category.title)}</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide">{cards.join(", ")}</p>
            </div>
          );
        })}
        {remainingCards.length ? (
          <div className="grid grid-cols-4 gap-2">
            {remainingCards.map((card, index) => (
              <span key={`${card.content}-${card.position ?? index}`} className="flex min-h-16 items-center justify-center rounded-md bg-[#efefe6] px-2 text-center text-xs font-bold uppercase text-[#1f1f1f] transition-all duration-300 animate-in fade-in zoom-in-95">
                {card.content}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {orderedColors.map((color) => {
          const isRevealed = revealed.has(color);
          const hasCategory = sortedCategories.some((category) => asString(category.color) === color);
          if (!hasCategory) return null;
          return (
            <button
              key={color}
              type="button"
              onClick={() => toggleColor(color)}
              aria-pressed={isRevealed}
              className={[
                "rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition-all duration-300",
                isRevealed ? colorClass[color] : "bg-surface text-muted ring-1 ring-border hover:text-foreground"
              ].join(" ")}
            >
              {isRevealed ? `Hide ${colorLabel[color]}` : `Reveal ${colorLabel[color]}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StrandsVisual({ payload }: { payload: AnyRecord }) {
  const board = asStringArray(payload.startingBoard);
  const spangram = asString(payload.spangram);
  const themeWords = asStringArray(payload.themeWords);
  const themeCoords = asRecord(payload.themeCoords) as Record<string, number[][]>;
  const spangramCoords = Array.isArray(payload.spangramCoords) ? (payload.spangramCoords as number[][]) : [];
  const [revealedWords, setRevealedWords] = useState<string[]>([]);
  const [revealProgress, setRevealProgress] = useState<Record<string, number>>({});
  const revealed = useMemo(() => new Set(revealedWords), [revealedWords]);
  const wordKeys = useMemo(() => [...(spangram ? ["__spangram"] : []), ...themeWords], [spangram, themeWords]);
  const allRevealed = wordKeys.length > 0 && wordKeys.every((word) => revealed.has(word));
  const rows = board.length;
  const cols = Math.max(...board.map((row) => row.length), 0);
  const unit = 72;
  const gap = 14;
  const revealStepMs = 150;
  const boardWidth = cols > 0 ? cols * unit + (cols - 1) * gap : 0;
  const boardHeight = rows > 0 ? rows * unit + (rows - 1) * gap : 0;
  const coordsByKey = useMemo(() => {
    const entries: Record<string, number[][]> = {};
    if (spangram) entries.__spangram = spangramCoords;
    themeWords.forEach((word) => {
      entries[word] = Array.isArray(themeCoords[word]) ? themeCoords[word] : [];
    });
    return entries;
  }, [spangram, spangramCoords, themeCoords, themeWords]);
  const pointForCoord = ([row, col]: number[]) => ({
    x: col * (unit + gap) + unit / 2,
    y: row * (unit + gap) + unit / 2
  });
  const paths = useMemo(() => {
    const entries = [
      ...(spangram ? [{ key: "__spangram", color: "#f7c600", coords: spangramCoords }] : []),
      ...themeWords.map((word) => ({ key: word, color: "#9bd8e6", coords: Array.isArray(themeCoords[word]) ? themeCoords[word] : [] }))
    ];
    return entries
      .filter((entry) => revealed.has(entry.key) && entry.coords.length > 0)
      .map((entry) => ({
        ...entry,
        segments: entry.coords.slice(1, revealProgress[entry.key] ?? 0).map((coord, index) => ({
          end: pointForCoord(coord),
          length: Math.hypot(pointForCoord(coord).x - pointForCoord(entry.coords[index]).x, pointForCoord(coord).y - pointForCoord(entry.coords[index]).y),
          start: pointForCoord(entry.coords[index])
        }))
      }));
  }, [revealProgress, revealed, spangram, spangramCoords, themeCoords, themeWords]);
  const revealedCoords = useMemo(() => {
    const coords = new Map<string, { order: number; status: "spangram" | "theme" }>();
    if (revealed.has("__spangram")) {
      spangramCoords.slice(0, revealProgress.__spangram ?? 0).forEach(([row, col], order) => coords.set(coordKey(row, col), { order, status: "spangram" }));
    }
    themeWords.forEach((word) => {
      if (!revealed.has(word) || !Array.isArray(themeCoords[word])) return;
      themeCoords[word].slice(0, revealProgress[word] ?? 0).forEach(([row, col], order) => {
        const key = coordKey(row, col);
        if (coords.get(key)?.status === "spangram") return;
        coords.set(key, { order, status: "theme" });
      });
    });
    return coords;
  }, [revealProgress, revealed, spangramCoords, themeCoords, themeWords]);

  useEffect(() => {
    const timers = wordKeys.flatMap((word) => {
      if (!revealed.has(word)) return [];
      const coords = coordsByKey[word] ?? [];
      const progress = revealProgress[word] ?? 0;
      if (progress >= coords.length) return [];
      const delay = progress === 0 ? 0 : revealStepMs;
      return [
        window.setTimeout(() => {
          setRevealProgress((current) => {
            const currentProgress = current[word] ?? 0;
            if (currentProgress >= coords.length) return current;
            return { ...current, [word]: currentProgress + 1 };
          });
        }, delay)
      ];
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [coordsByKey, revealProgress, revealed, revealStepMs, wordKeys]);

  function toggleWord(word: string) {
    setRevealedWords((current) => {
      const isRevealed = current.includes(word);
      if (isRevealed) {
        setRevealProgress((progress) => {
          const next = { ...progress };
          delete next[word];
          return next;
        });
        return current.filter((entry) => entry !== word);
      }
      setRevealProgress((progress) => ({ ...progress, [word]: 0 }));
      return [...current, word];
    });
  }

  function revealAllWords() {
    setRevealedWords(wordKeys);
    setRevealProgress(Object.fromEntries(wordKeys.map((word) => [word, 0])));
  }

  function hideAllWords() {
    setRevealedWords([]);
    setRevealProgress({});
  }

  function wordButtonClass(key: string) {
    const isRevealed = revealed.has(key);
    if (key === "__spangram") {
      return isRevealed ? "bg-[#f7c600] text-[#111111]" : "bg-surface text-muted ring-1 ring-border hover:text-foreground";
    }
    return isRevealed ? "bg-[#9bd8e6] text-[#111111]" : "bg-surface text-muted ring-1 ring-border hover:text-foreground";
  }

  if (!rows || !cols) {
    return null;
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-[minmax(15rem,18rem)_minmax(18rem,22rem)] md:items-start md:justify-center">
      <div className="space-y-3">
        {asString(payload.clue) ? (
          <div className="overflow-hidden rounded-md border border-border bg-background text-center shadow-sm">
            <p className="bg-surface px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-muted">Today's Theme</p>
            <p className="px-4 py-4 text-xl font-extrabold text-foreground">{asString(payload.clue)}</p>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
          {spangram ? (
            <button
              type="button"
              aria-pressed={revealed.has("__spangram")}
              onClick={() => toggleWord("__spangram")}
              className={`min-h-10 overflow-hidden truncate rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition-all duration-300 ${wordButtonClass("__spangram")}`}
            >
              {revealed.has("__spangram") ? spangram : "Reveal spangram"}
            </button>
          ) : null}
          {themeWords.map((word, index) => (
            <button
              key={word}
              type="button"
              aria-pressed={revealed.has(word)}
              onClick={() => toggleWord(word)}
              className={`min-h-10 overflow-hidden truncate rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition-all duration-300 ${wordButtonClass(word)}`}
            >
              {revealed.has(word) ? word : `Reveal word ${index + 1}`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={revealAllWords}
            disabled={allRevealed}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reveal all words
          </button>
          <button
            type="button"
            onClick={hideAllWords}
            disabled={!revealedWords.length}
            className="rounded-md bg-surface px-4 py-2 text-sm font-semibold text-foreground ring-1 ring-border transition hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hide all words
          </button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[20rem] rounded-md border border-border bg-background p-3 text-foreground shadow-sm sm:max-w-[21rem]">
        <div className="relative w-full" style={{ aspectRatio: `${boardWidth} / ${boardHeight}` }} aria-label="Strands answer board">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${boardWidth} ${boardHeight}`} aria-hidden="true">
            {paths.flatMap((path) =>
              path.segments.map((segment, index) => (
                <line
                  key={`${path.key}-${index}`}
                  x1={segment.start.x}
                  y1={segment.start.y}
                  x2={segment.end.x}
                  y2={segment.end.y}
                  stroke={path.color}
                  strokeLinecap="round"
                  strokeWidth="22"
                  opacity="0"
                  strokeDasharray={segment.length}
                  strokeDashoffset={segment.length}
                >
                  <animate attributeName="opacity" from="0" to="1" dur="1ms" begin="0ms" fill="freeze" />
                  <animate attributeName="stroke-dashoffset" from={segment.length} to="0" dur="140ms" begin="0ms" fill="freeze" />
                </line>
              ))
            )}
          </svg>
          {board.flatMap((row, rowIndex) =>
            row.split("").map((letter, colIndex) => {
              const key = coordKey(rowIndex, colIndex);
              const reveal = revealedCoords.get(key);
              const status = reveal?.status;
              return (
                <span
                  key={`${key}-${status ?? "hidden"}`}
                  className={[
                    "absolute flex items-center justify-center rounded-full text-xl font-medium uppercase transition-all duration-300 sm:text-2xl",
                    status === "spangram"
                      ? "scale-105 bg-[#f7c600] font-semibold text-[#111111] shadow-sm animate-in fade-in zoom-in-75"
                      : status === "theme"
                        ? "scale-105 bg-[#9bd8e6] font-semibold text-[#111111] shadow-sm animate-in fade-in zoom-in-75"
                        : "bg-transparent text-foreground"
                  ].join(" ")}
                  style={{
                    animationFillMode: reveal ? "both" : undefined,
                    height: `${(unit / boardHeight) * 100}%`,
                    left: `${((colIndex * (unit + gap)) / boardWidth) * 100}%`,
                    top: `${((rowIndex * (unit + gap)) / boardHeight) * 100}%`,
                    width: `${(unit / boardWidth) * 100}%`
                  }}
                >
                  {letter}
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function BeeHoneycomb({ center, outer }: { center: string; outer: string[] }) {
  const positions = [
    "left-[3.15rem] top-0",
    "left-[6.3rem] top-[1.8rem]",
    "left-[6.3rem] top-[5.4rem]",
    "left-[3.15rem] top-[7.2rem]",
    "left-0 top-[5.4rem]",
    "left-0 top-[1.8rem]"
  ];
  return (
    <div className="relative h-[10.8rem] w-[10.8rem]">
      {outer.slice(0, 6).map((letter, index) => (
        <span key={`${letter}-${index}`} className={`absolute ${positions[index]} flex h-14 w-14 items-center justify-center bg-[#e6e6e6] text-xl font-bold uppercase text-[#1f1f1f] [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]`}>
          {letter}
        </span>
      ))}
      <span className="absolute left-[3.15rem] top-[3.6rem] flex h-14 w-14 items-center justify-center bg-[#f7da21] text-xl font-bold uppercase text-[#1f1f1f] [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]">
        {center}
      </span>
    </div>
  );
}

function SpellingBeeVisual({ payload }: { payload: AnyRecord }) {
  const [showPangrams, setShowPangrams] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const pangrams = asStringArray(payload.pangrams);
  const answers = asStringArray(payload.answers);
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      <button type="button" className="text-left" onClick={() => setShowPangrams(true)} aria-label="Open Spelling Bee pangrams">
        <BeeHoneycomb center={asString(payload.centerLetter)} outer={asStringArray(payload.outerLetters)} />
      </button>
      <div className="space-y-4">
        <div>
          <button type="button" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted" onClick={() => setShowPangrams(true)}>
            Pangrams
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            {(showPangrams ? pangrams : pangrams.map((_, index) => `Pangram ${index + 1}`)).map((word) => (
              <span key={word} className="rounded-full bg-[#f7da21] px-3 py-1 text-sm font-bold uppercase text-[#1f1f1f]">{word}</span>
            ))}
          </div>
        </div>
        <button type="button" className="text-sm text-muted" onClick={() => setShowWords(true)}>
          {showWords ? `${answers.length} accepted answers` : "Tap to open the full accepted word list"}
        </button>
        {showWords ? (
          <div className="flex flex-wrap gap-2">
            {answers.map((word) => <span key={word} className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-foreground">{word}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function letterPosition(sideIndex: number, letterIndex: number) {
  const step = 50;
  const offset = 50 + letterIndex * step;
  if (sideIndex === 0) return { x: offset, y: 0 };
  if (sideIndex === 1) return { x: 200, y: offset };
  if (sideIndex === 2) return { x: 150 - letterIndex * step, y: 200 };
  return { x: 0, y: 150 - letterIndex * step };
}

function LetterBoxedVisual({ payload }: { payload: AnyRecord }) {
  const solution = asStringArray(payload.solution);
  const sides = asStringArray(payload.sides);
  const [revealed, setRevealed] = useState(0);
  const positions = new Map<string, { x: number; y: number }>();
  sides.forEach((side, sideIndex) => side.split("").forEach((letter, letterIndex) => positions.set(letter, letterPosition(sideIndex, letterIndex))));
  const paths = solution.map((word) => word.toUpperCase().split("").map((letter) => positions.get(letter)).filter((point): point is { x: number; y: number } => Boolean(point)));

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <button type="button" className="text-left" onClick={() => setRevealed((value) => nextValue(value, solution.length))} aria-label="Draw next Letter Boxed solution path">
        <svg viewBox="-30 -30 260 260" className="h-60 w-60 overflow-visible rounded-2xl bg-surface p-4">
          <rect x="0" y="0" width="200" height="200" fill="none" stroke="rgb(var(--color-border))" strokeWidth="2" />
          {paths.slice(0, revealed).map((path, index) => (
            <polyline key={`${solution[index]}-${index}`} points={path.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={index === 0 ? "rgb(var(--color-accent))" : "#f6c945"} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
          ))}
          {sides.map((side, sideIndex) =>
            side.split("").map((letter, letterIndex) => {
              const point = letterPosition(sideIndex, letterIndex);
              return (
                <g key={`${letter}-${sideIndex}-${letterIndex}`}>
                  <circle cx={point.x} cy={point.y} r="15" fill="rgb(var(--color-background))" stroke="rgb(var(--color-border))" />
                  <text x={point.x} y={point.y + 5} textAnchor="middle" className="fill-foreground text-sm font-bold">{letter}</text>
                </g>
              );
            })
          )}
        </svg>
      </button>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Solution chain</p>
        <ol className="list-decimal space-y-1 pl-5 text-lg font-semibold text-foreground">
          {solution.map((word, index) => <li key={word}>{index < revealed ? word : `Word ${index + 1}`}</li>)}
        </ol>
        {asNumber(payload.par) ? <p className="mt-2 text-sm text-muted">Par: {asNumber(payload.par)}</p> : null}
      </div>
    </div>
  );
}

function NumberGrid({
  values,
  cols,
  visible,
  presetIndexes = [],
  onClick
}: {
  values: number[];
  cols: number;
  visible: Set<number>;
  presetIndexes?: number[];
  onClick: () => void;
}) {
  const preset = new Set(presetIndexes);
  if (!values.length || cols <= 0) return null;
  return (
    <button type="button" className="inline-grid overflow-hidden rounded-md bg-foreground/80 p-0.5 text-left" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.25rem))` }} onClick={onClick} aria-label="Fill more solved grid cells">
      {values.map((value, index) => {
        const isVisible = preset.has(index) || visible.has(index);
        return (
          <span key={index} className={`m-px flex aspect-square items-center justify-center text-sm font-semibold transition-colors ${preset.has(index) ? "bg-accent/20 text-accent" : "bg-card text-foreground"}`}>
            {isVisible ? value || "" : ""}
          </span>
        );
      })}
    </button>
  );
}

function SudokuVisual({ payload }: { payload: AnyRecord }) {
  const [rows, setRows] = useState<Record<DifficultyKey, number>>({ easy: 0, medium: 0, hard: 0 });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["easy", "medium", "hard"] as DifficultyKey[]).map((difficulty) => {
        const entry = asRecord(payload[difficulty]);
        const solution = asNumberArray(entry.solution);
        const visible = new Set(Array.from({ length: Math.min(rows[difficulty], 9) * 9 }, (_, index) => index));
        return (
          <div key={difficulty} className="space-y-3">
            <p className="text-sm font-semibold capitalize text-foreground">{difficulty} puzzle {asNumber(entry.puzzleId) ? `#${asNumber(entry.puzzleId)}` : ""}</p>
            <div className="overflow-x-auto">
              <NumberGrid values={solution} cols={9} visible={visible} onClick={() => setRows((prev) => ({ ...prev, [difficulty]: nextValue(prev[difficulty], 9) }))} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipsBoard({ entry, revealed }: { entry: AnyRecord; revealed: number }) {
  const regions = Array.isArray(entry.regions) ? (entry.regions as AnyRecord[]) : [];
  const dominoes = Array.isArray(entry.dominoes) ? (entry.dominoes as unknown[]) : [];
  const solution = Array.isArray(entry.solution) ? (entry.solution as unknown[]) : [];
  const coords = [
    ...regions.flatMap((region) => (Array.isArray(region.indices) ? (region.indices as number[][]) : [])),
    ...solution.flatMap((pair) => (Array.isArray(pair) ? (pair as number[][]) : []))
  ];
  const rows = Math.max(0, ...coords.map((coord) => coord[0] ?? 0)) + 1;
  const cols = Math.max(0, ...coords.map((coord) => coord[1] ?? 0)) + 1;
  const values = new Map<string, number>();
  const dominoIds = new Map<string, number>();
  solution.slice(0, revealed).forEach((pair, index) => {
    if (!Array.isArray(pair)) return;
    const dots = Array.isArray(dominoes[index]) ? (dominoes[index] as number[]) : [];
    pair.forEach((coord, coordIndex) => {
      if (!Array.isArray(coord)) return;
      values.set(coordKey(coord[0], coord[1]), dots[coordIndex] ?? 0);
      dominoIds.set(coordKey(coord[0], coord[1]), index);
    });
  });
  const regionByCell = new Map<string, number>();
  const regionLabelByCell = new Map<string, string>();
  regions.forEach((region, index) => {
    const indices = Array.isArray(region.indices) ? (region.indices as number[][]) : [];
    const label = [asString(region.type), asNumber(region.target)].filter((value) => value !== null && value !== "").join(" ");
    indices.forEach((coord, coordIndex) => {
      regionByCell.set(coordKey(coord[0], coord[1]), index);
      if (coordIndex === 0 && label) regionLabelByCell.set(coordKey(coord[0], coord[1]), label);
    });
  });
  const colors = ["bg-[#f5d0a9]", "bg-[#c6e6c1]", "bg-[#c9d8f0]", "bg-[#ead2f0]", "bg-[#f4e6a6]", "bg-[#cce8e5]"];
  return (
    <div className="inline-grid gap-1 rounded-2xl bg-[#ede8df] p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.6rem))` }}>
      {Array.from({ length: rows * cols }, (_, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const key = coordKey(row, col);
        const region = regionByCell.get(key) ?? 0;
        const domino = dominoIds.get(key);
        return (
          <span key={key} className={`relative flex aspect-square items-center justify-center rounded-md text-lg font-bold text-[#1f1f1f] ${colors[region % colors.length]}`}>
            {regionLabelByCell.get(key) ? <span className="absolute left-1 top-0.5 text-[0.48rem] font-bold uppercase text-[#1f1f1f]/60">{regionLabelByCell.get(key)}</span> : null}
            {values.get(key) ?? ""}
            {domino !== undefined ? <span className="absolute bottom-0.5 right-1 text-[0.45rem] text-[#1f1f1f]/50">#{domino + 1}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function PipsVisual({ payload }: { payload: AnyRecord }) {
  const [revealed, setRevealed] = useState<Record<DifficultyKey, number>>({ easy: 0, medium: 0, hard: 0 });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["easy", "medium", "hard"] as DifficultyKey[]).map((difficulty) => {
        const entry = asRecord(payload[difficulty]);
        const max = Array.isArray(entry.solution) ? entry.solution.length : 0;
        return (
          <div key={difficulty} className="space-y-3">
            <p className="text-sm font-semibold capitalize text-foreground">{difficulty} puzzle {asNumber(entry.puzzleId) ? `#${asNumber(entry.puzzleId)}` : ""}</p>
            <button type="button" className="overflow-x-auto text-left" onClick={() => setRevealed((prev) => ({ ...prev, [difficulty]: nextValue(prev[difficulty], max) }))}>
              <PipsBoard entry={entry} revealed={revealed[difficulty]} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ZipVisual({ payload }: { payload: AnyRecord }) {
  const gridSize = asNumber(payload.gridSize) ?? 0;
  const solution = asNumberArray(payload.solution);
  const waypoints = asNumberArray(payload.orderedSequence);
  const waypointSet = new Set(waypoints);
  const waypointIndex = new Map(waypoints.map((cell, index) => [cell, index + 1]));
  const [progress, setProgress] = useState(0);
  const points = solution.slice(0, progress).map((cell) => coordFromCell(cell, gridSize));
  const step = Math.max(3, Math.ceil(solution.length / 8));
  if (!gridSize || !solution.length) return <WordSlots answer="Path data unavailable" />;
  return (
    <button type="button" className="relative inline-block rounded-2xl bg-[#eef3f8] p-3 text-left" onClick={() => setProgress((value) => nextValue(value, solution.length, step))}>
      <svg className="pointer-events-none absolute left-3 top-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]" viewBox={`0 0 ${gridSize} ${gridSize}`} preserveAspectRatio="none" aria-hidden>
        <polyline points={points.map((point) => `${point.col + 0.5},${point.row + 0.5}`).join(" ")} fill="none" stroke="#0a66c2" strokeWidth="0.16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="relative grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 2.4rem))` }}>
        {Array.from({ length: gridSize * gridSize }, (_, cell) => (
          <span key={cell} className="z-10 flex aspect-square items-center justify-center rounded-md bg-white text-xs font-bold text-[#0a66c2]">
            {waypointSet.has(cell) ? waypointIndex.get(cell) : ""}
          </span>
        ))}
      </div>
    </button>
  );
}

function QueensVisual({ payload }: { payload: AnyRecord }) {
  const gridSize = asNumber(payload.gridSize) ?? 0;
  const colorGrid = asNumberArray(payload.colorGrid);
  const solution = Array.isArray(payload.solution) ? payload.solution.map(asRecord) : [];
  const [revealed, setRevealed] = useState(0);
  const queens = new Set(solution.slice(0, revealed).map((entry) => `${asNumber(entry.row) ?? -1},${asNumber(entry.col) ?? -1}`));
  const colors = ["bg-[#f5a6aa]", "bg-[#9ed7f5]", "bg-[#a9d79e]", "bg-[#f3dc83]", "bg-[#c9a7e8]", "bg-[#f0b37e]"];
  if (!gridSize) return <WordSlots answer="Grid data unavailable" />;
  return (
    <button type="button" className="inline-grid gap-0.5 rounded-2xl bg-surface p-3 text-left" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 2.4rem))` }} onClick={() => setRevealed((value) => nextValue(value, solution.length))}>
      {Array.from({ length: gridSize * gridSize }, (_, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const tone = (colorGrid[index] ?? 0) % colors.length;
        return <span key={index} className={`flex aspect-square items-center justify-center rounded-[0.2rem] text-lg font-black text-[#1f1f1f] transition-transform ${colors[tone]}`}>{queens.has(`${row},${col}`) ? "♛" : ""}</span>;
      })}
    </button>
  );
}

function TangoVisual({ payload }: { payload: AnyRecord }) {
  const gridSize = asNumber(payload.gridSize) ?? 0;
  const solution = asStringArray(payload.solution);
  const presets = new Set(asNumberArray(payload.presetCellIdxes));
  const fillOrder = solution.map((_, index) => index).filter((index) => !presets.has(index));
  const [revealed, setRevealed] = useState(0);
  const visible = new Set([...Array.from(presets), ...fillOrder.slice(0, revealed)]);
  if (!gridSize) return <WordSlots answer="Grid data unavailable" />;
  return (
    <button type="button" className="inline-grid gap-1 rounded-2xl bg-[#f3f0ea] p-3 text-left" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 2.6rem))` }} onClick={() => setRevealed((value) => nextValue(value, fillOrder.length))}>
      {Array.from({ length: gridSize * gridSize }, (_, index) => {
        const isOne = solution[index] === "ONE";
        return (
          <span key={index} className={`flex aspect-square items-center justify-center rounded-md text-lg font-bold ${isOne ? "bg-[#f7d66f]" : "bg-[#b8d5f0]"} text-[#1f1f1f] ${presets.has(index) ? "ring-2 ring-[#1f1f1f]/50" : ""}`}>
            {visible.has(index) ? (isOne ? "☀" : "☾") : ""}
          </span>
        );
      })}
    </button>
  );
}

function MiniSudokuVisual({ payload }: { payload: AnyRecord }) {
  const cols = asNumber(payload.gridColSize) ?? 0;
  const values = asNumberArray(payload.solution);
  const rows = Math.ceil(values.length / Math.max(cols, 1));
  const [visibleRows, setVisibleRows] = useState(0);
  const preset = asNumberArray(payload.presetCellIdxes);
  const visible = new Set(Array.from({ length: Math.min(visibleRows, rows) * cols }, (_, index) => index));
  return (
    <div className="space-y-3">
      {asString(payload.name) ? <p className="text-sm font-semibold text-foreground">{asString(payload.name)}</p> : null}
      <div className="overflow-x-auto">
        <NumberGrid values={values} cols={cols} visible={visible} presetIndexes={preset} onClick={() => setVisibleRows((value) => nextValue(value, rows))} />
      </div>
    </div>
  );
}

function CrossclimbVisual({ payload }: { payload: AnyRecord }) {
  const words = asStringArray(payload.words);
  const clues = asStringArray(payload.clues);
  const [revealed, setRevealed] = useState(0);
  return (
    <button type="button" className="max-w-xl space-y-2 text-left" onClick={() => setRevealed((value) => nextValue(value, words.length))}>
      {words.map((word, index) => {
        const previous = words[index - 1] ?? "";
        const isVisible = index < revealed;
        return (
          <div key={`${word}-${index}`} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
            <div className="flex justify-center rounded-md bg-[#dbeafe] px-4 py-3 font-mono text-lg font-black uppercase tracking-[0.22em] text-[#1f1f1f]">
              {(isVisible ? word : " ".repeat(word.length || 5)).split("").map((letter, letterIndex) => (
                <span key={`${letter}-${letterIndex}`} className={previous && previous[letterIndex] !== letter ? "text-[#0a66c2]" : ""}>
                  {letter || "_"}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted">{clues[index] ?? ""}</p>
          </div>
        );
      })}
    </button>
  );
}

function WordSlots({ answer, meaning }: { answer: string; meaning?: string }) {
  const letters = answer.toUpperCase().split("").filter(Boolean);
  const [revealed, setRevealed] = useState(0);
  return (
    <div className="space-y-3">
      <button type="button" className="flex flex-wrap gap-2 text-left" onClick={() => setRevealed((value) => nextValue(value, letters.length))}>
        {letters.map((letter, index) => (
          <span key={`${letter}-${index}`} className="flex h-11 min-w-11 items-center justify-center rounded-md bg-accent px-3 text-lg font-bold text-accent-foreground">
            {index < revealed ? letter : ""}
          </span>
        ))}
      </button>
      {meaning && revealed >= letters.length ? <p className="max-w-2xl text-sm text-muted">{meaning}</p> : null}
    </div>
  );
}

export function PuzzleVisualAnswer({
  puzzleSlug,
  payload,
  summary
}: {
  puzzleSlug: string;
  payload: unknown;
  summary: unknown;
}) {
  const data = asRecord(payload);
  const answerSummary = asRecord(summary);

  switch (puzzleSlug) {
    case "wordle":
      return <WordleVisual payload={data} summary={answerSummary} />;
    case "connections":
      return <ConnectionsVisual payload={data} />;
    case "strands":
      return <StrandsVisual payload={data} />;
    case "spelling-bee":
      return <SpellingBeeVisual payload={data} />;
    case "letter-boxed":
      return <LetterBoxedVisual payload={data} />;
    case "sudoku":
      return <SudokuVisual payload={data} />;
    case "pips":
      return <PipsVisual payload={data} />;
    case "linkedin-zip":
      return <ZipVisual payload={data} />;
    case "linkedin-queens":
      return <QueensVisual payload={data} />;
    case "linkedin-tango":
      return <TangoVisual payload={data} />;
    case "linkedin-mini-sudoku":
      return <MiniSudokuVisual payload={data} />;
    case "linkedin-crossclimb":
      return <CrossclimbVisual payload={data} />;
    case "contexto":
    case "letroso":
      return <WordSlots answer={asString(data.answer) || asString(answerSummary.answer)} meaning={asString(data.meaning)} />;
    default:
      return <WordSlots answer={asString(answerSummary.answer) || "Answer saved"} />;
  }
}

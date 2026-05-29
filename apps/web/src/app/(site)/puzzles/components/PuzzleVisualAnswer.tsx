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
    "left-[3.6rem] top-0",
    "left-[7.2rem] top-[2.05rem]",
    "left-[7.2rem] top-[6.15rem]",
    "left-[3.6rem] top-[8.2rem]",
    "left-0 top-[6.15rem]",
    "left-0 top-[2.05rem]"
  ];
  return (
    <div className="relative h-[12.3rem] w-[12.3rem]">
      {outer.slice(0, 6).map((letter, index) => (
        <span key={`${letter}-${index}`} className={`absolute ${positions[index]} flex h-16 w-16 items-center justify-center bg-[#e6e6e6] text-2xl font-bold uppercase text-[#1f1f1f] [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]`}>
          {letter}
        </span>
      ))}
      <span className="absolute left-[3.6rem] top-[4.1rem] flex h-16 w-16 items-center justify-center bg-[#f7da21] text-2xl font-bold uppercase text-[#1f1f1f] [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]">
        {center}
      </span>
    </div>
  );
}

function SpellingBeeVisual({ payload }: { payload: AnyRecord }) {
  const pangrams = asStringArray(payload.pangrams);
  const answers = asStringArray(payload.answers);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(() => new Set());
  const pangramSet = useMemo(() => new Set(pangrams.map((word) => word.toLowerCase())), [pangrams]);
  const groupedAnswers = useMemo(() => {
    const groups = new Map<number, string[]>();
    answers.forEach((word) => {
      const length = word.length;
      groups.set(length, [...(groups.get(length) ?? []), word]);
    });
    return [...groups.entries()]
      .sort(([lengthA], [lengthB]) => lengthA - lengthB)
      .map(([length, words]) => ({ length, words: [...words].sort((a, b) => a.localeCompare(b)) }));
  }, [answers]);
  const revealedPangrams = pangrams.filter((word) => revealedWords.has(word.toLowerCase()));
  const allPangramsRevealed = pangrams.length > 0 && revealedPangrams.length === pangrams.length;

  function revealNextWord(words: string[]) {
    setRevealedWords((current) => {
      const next = new Set(current);
      const hiddenWord = words.find((word) => !next.has(word.toLowerCase()));
      if (hiddenWord) next.add(hiddenWord.toLowerCase());
      return next;
    });
  }

  function revealWordGroup(words: string[]) {
    setRevealedWords((current) => {
      const next = new Set(current);
      words.forEach((word) => next.add(word.toLowerCase()));
      return next;
    });
  }

  function hideWordGroup(words: string[]) {
    setRevealedWords((current) => {
      const next = new Set(current);
      words.forEach((word) => next.delete(word.toLowerCase()));
      return next;
    });
  }

  function revealPangrams() {
    setRevealedWords((current) => {
      const next = new Set(current);
      pangrams.forEach((word) => next.add(word.toLowerCase()));
      return next;
    });
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
      <div className="flex justify-center lg:justify-start">
        <BeeHoneycomb center={asString(payload.centerLetter)} outer={asStringArray(payload.outerLetters)} />
      </div>

      <div className="space-y-5">
        {pangrams.length ? (
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                Pangram{pangrams.length === 1 ? "" : "s"}: {revealedPangrams.length} of {pangrams.length} revealed
              </p>
              <button
                type="button"
                onClick={revealPangrams}
                disabled={allPangramsRevealed}
                className="inline-flex min-w-36 items-center justify-center rounded-md bg-[#f7da21] px-4 py-2 text-sm font-extrabold text-[#1f1f1f] transition hover:bg-[#efd01e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {allPangramsRevealed ? "Pangram revealed" : "Reveal pangram"}
              </button>
            </div>
            <div className="mt-3 flex min-h-9 flex-wrap gap-2">
              {pangrams.map((word, index) => {
                const isVisible = revealedWords.has(word.toLowerCase());
                return (
                  <span key={`${word}-${index}`} className={`flex min-h-9 items-center justify-center rounded-md px-3 py-1 text-sm font-bold uppercase ${isVisible ? "bg-[#f7da21] text-[#1f1f1f]" : "bg-card text-muted ring-1 ring-border"}`}>
                    {isVisible ? word : `Pangram ${index + 1}`}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {groupedAnswers.map(({ length, words }) => {
            const visibleCount = words.filter((word) => revealedWords.has(word.toLowerCase())).length;
            const allVisible = visibleCount === words.length;
            return (
              <section key={length} className="space-y-3 rounded-md border border-border bg-surface p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] sm:items-center">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">
                      There {words.length === 1 ? "is" : "are"} {words.length} {words.length === 1 ? "word" : "words"} with {length} letters
                    </h4>
                    <p className="mt-1 text-sm text-muted">{visibleCount} of {words.length} revealed</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => revealNextWord(words)}
                      disabled={allVisible}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    >
                      One word
                    </button>
                    <button
                      type="button"
                      onClick={() => revealWordGroup(words)}
                      disabled={allVisible}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-accent px-2 py-2 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    >
                      Reveal all
                    </button>
                    <button
                      type="button"
                      onClick={() => hideWordGroup(words)}
                      disabled={visibleCount === 0}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border bg-background px-2 py-2 text-xs font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    >
                      Hide all
                    </button>
                  </div>
                </div>
                <div className="grid min-h-10 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {words.map((word, index) => {
                    const isVisible = revealedWords.has(word.toLowerCase());
                    const isPangram = pangramSet.has(word.toLowerCase());
                    return (
                      <span
                        key={`${word}-${index}`}
                        className={[
                          "flex min-h-9 items-center justify-center rounded-md px-2 text-center text-xs font-bold uppercase transition-colors",
                          isVisible
                            ? isPangram
                              ? "bg-[#f7da21] text-[#1f1f1f]"
                              : "bg-card text-foreground ring-1 ring-border"
                            : "bg-background text-muted/70 ring-1 ring-border/60"
                        ].join(" ")}
                      >
                        {isVisible ? word : `Word ${index + 1}`}
                      </span>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
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

function asSudokuValues(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((entry) => {
        if (typeof entry === "number" && Number.isFinite(entry)) return entry;
        if (typeof entry === "string") {
          const parsed = Number.parseInt(entry, 10);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      })
    : [];
}

function SudokuBoard({
  puzzle,
  solution,
  revealed,
  onToggle
}: {
  puzzle: number[];
  solution: number[];
  revealed: Set<number>;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="grid aspect-square w-full max-w-[29rem] grid-cols-9 overflow-hidden rounded-md border-[3px] border-[#111111] bg-[#111111] shadow-sm dark:border-foreground/90 dark:bg-foreground/90">
      {Array.from({ length: 81 }, (_, index) => {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const given = puzzle[index] ?? 0;
        const value = solution[index] ?? 0;
        const isGiven = given > 0;
        const isRevealed = isGiven || revealed.has(index);
        const thickRight = col === 2 || col === 5;
        const thickBottom = row === 2 || row === 5;
        const borderClasses = [
          "border-[#9d9d9d] dark:border-[#555a61]",
          thickRight ? "border-r-[3px] border-r-[#777777] dark:border-r-foreground/75" : "border-r",
          thickBottom ? "border-b-[3px] border-b-[#777777] dark:border-b-foreground/75" : "border-b",
          col === 8 ? "border-r-0" : "",
          row === 8 ? "border-b-0" : ""
        ].join(" ");
        const baseClasses =
          "flex aspect-square items-center justify-center text-xl font-black leading-none transition-colors duration-200 sm:text-2xl md:text-3xl";

        if (isGiven) {
          return (
            <span key={index} className={`${baseClasses} ${borderClasses} bg-[#d9d9d9] text-[#111111] dark:bg-[#262a31] dark:text-foreground`}>
              {given}
            </span>
          );
        }

        return (
          <button
            key={index}
            type="button"
            aria-pressed={revealed.has(index)}
            aria-label={isRevealed ? `Hide row ${row + 1} column ${col + 1}` : `Reveal row ${row + 1} column ${col + 1}`}
            onClick={() => onToggle(index)}
            className={`${baseClasses} ${borderClasses} ${
              isRevealed
                ? "bg-[#f4c45f] text-[#111111] shadow-inner dark:bg-[#e0ad43] dark:text-[#111111]"
                : "bg-[#fff1c8] text-transparent hover:bg-[#f8e5ad] dark:bg-[#111318] dark:hover:bg-[#191d24]"
            }`}
          >
            {isRevealed ? value : ""}
          </button>
        );
      })}
    </div>
  );
}

function SudokuDifficulty({
  difficulty,
  entry
}: {
  difficulty: DifficultyKey;
  entry: AnyRecord;
}) {
  const puzzle = asSudokuValues(entry.puzzle).slice(0, 81);
  const solution = asSudokuValues(entry.solution).slice(0, 81);
  const revealableIndexes = useMemo(
    () => solution.map((value, index) => (value > 0 && !(puzzle[index] > 0) ? index : -1)).filter((index) => index >= 0),
    [puzzle, solution]
  );
  const [revealedCells, setRevealedCells] = useState<Set<number>>(() => new Set());
  const allVisible = revealableIndexes.length > 0 && revealedCells.size >= revealableIndexes.length;
  const puzzleId = asNumber(entry.puzzleId);

  function toggleCell(index: number) {
    setRevealedCells((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function showAll() {
    setRevealedCells(new Set(revealableIndexes));
  }

  function hideAll() {
    setRevealedCells(new Set());
  }

  if (solution.length < 81) {
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-semibold capitalize text-foreground">{difficulty}</h3>
        <WordSlots answer="Grid data unavailable" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold capitalize text-foreground">
          {difficulty} Sudoku {puzzleId ? <span className="text-muted">#{puzzleId}</span> : null}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Fixed clues are already filled. Tap any empty cell to reveal or hide only that answer.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,29rem)_10rem] lg:items-start">
        <SudokuBoard puzzle={puzzle} solution={solution} revealed={revealedCells} onToggle={toggleCell} />
        <div className="flex flex-wrap gap-2 lg:flex-col">
          <button
            type="button"
            onClick={showAll}
            disabled={allVisible}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reveal all
          </button>
          <button
            type="button"
            onClick={hideAll}
            disabled={!revealedCells.size}
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hide all
          </button>
        </div>
      </div>
    </section>
  );
}

function SudokuVisual({ payload }: { payload: AnyRecord }) {
  return (
    <div className="space-y-10">
      {(["easy", "medium", "hard"] as DifficultyKey[]).map((difficulty) => {
        const entry = asRecord(payload[difficulty]);
        return <SudokuDifficulty key={difficulty} difficulty={difficulty} entry={entry} />;
      })}
    </div>
  );
}

type PipsCoord = [number, number];
type PipsDomino = [number, number];
type PipsRegionPalette = { fill: string; stroke: string; badge: string };
type PipsRegion = { indices: PipsCoord[]; type: string; target: number | null; palette: PipsRegionPalette | null };

const PIPS_REGION_PALETTES: PipsRegionPalette[] = [
  { fill: "#c7a8c8", stroke: "#7617d6", badge: "#9251ca" },
  { fill: "#e49baa", stroke: "#c70042", badge: "#db137a" },
  { fill: "#a8bec4", stroke: "#006c7b", badge: "#008ea4" },
  { fill: "#ebbf97", stroke: "#b94b00", badge: "#d35a08" },
  { fill: "#b5b0bf", stroke: "#0c386a", badge: "#124076" },
  { fill: "#bcb589", stroke: "#486700", badge: "#618200" }
];

function asPipsCoord(value: unknown): PipsCoord | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const row = asNumber(value[0]);
  const col = asNumber(value[1]);
  return row === null || col === null ? null : [row, col];
}

function asPipsDomino(value: unknown): PipsDomino | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const first = asNumber(value[0]);
  const second = asNumber(value[1]);
  return first === null || second === null ? null : [first, second];
}

function asPipsRegions(value: unknown): PipsRegion[] {
  if (!Array.isArray(value)) return [];
  let paletteIndex = 0;
  return value.map(asRecord).map((region) => {
    const indices = Array.isArray(region.indices) ? region.indices.map(asPipsCoord).filter((coord): coord is PipsCoord => Boolean(coord)) : [];
    const type = asString(region.type);
    const palette = type === "empty" ? null : PIPS_REGION_PALETTES[paletteIndex % PIPS_REGION_PALETTES.length] ?? null;
    if (palette) paletteIndex += 1;
    return { indices, type, target: asNumber(region.target), palette };
  });
}

function asPipsSolution(value: unknown): [PipsCoord, PipsCoord][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const first = asPipsCoord(pair[0]);
      const second = asPipsCoord(pair[1]);
      return first && second ? ([first, second] as [PipsCoord, PipsCoord]) : null;
    })
    .filter((pair): pair is [PipsCoord, PipsCoord] => Boolean(pair));
}

function pipsDotOffsets(value: number, spreadX: number, spreadY: number): [number, number][] {
  const left = -spreadX;
  const right = spreadX;
  const top = -spreadY;
  const bottom = spreadY;
  if (value === 1) return [[0, 0]];
  if (value === 2) return [[left, top], [right, bottom]];
  if (value === 3) return [[left, top], [0, 0], [right, bottom]];
  if (value === 4) return [[left, top], [right, top], [left, bottom], [right, bottom]];
  if (value === 5) return [[left, top], [right, top], [0, 0], [left, bottom], [right, bottom]];
  if (value === 6) return [[left, top], [right, top], [left, 0], [right, 0], [left, bottom], [right, bottom]];
  return [];
}

function pipsClueLabel(region: PipsRegion) {
  if (region.type === "equals") return "=";
  if (region.type === "unequal") return "≠";
  if (region.type === "sum") return String(region.target ?? "");
  if (region.type === "greater") return `>${region.target ?? ""}`;
  if (region.type === "less") return `<${region.target ?? ""}`;
  return "";
}

function pipsCellBackgroundPath(cells: Set<string>, cellTopLeft: (row: number, col: number) => { x: number; y: number }, cellSize: number, gap: number, radius: number, outlinePad = 0) {
  const paths: string[] = [];
  const size = cellSize + outlinePad * 2;
  const bridgeGap = Math.max(0, gap - outlinePad * 2);

  cells.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    const raw = cellTopLeft(row, col);
    const x = raw.x - outlinePad;
    const y = raw.y - outlinePad;
    const top = !cells.has(coordKey(row - 1, col));
    const right = !cells.has(coordKey(row, col + 1));
    const bottom = !cells.has(coordKey(row + 1, col));
    const left = !cells.has(coordKey(row, col - 1));
    const rightNeighbor = cells.has(coordKey(row, col + 1));
    const bottomNeighbor = cells.has(coordKey(row + 1, col));
    const rTopLeft = top || left ? radius : 0;
    const rTopRight = top || right ? radius : 0;
    const rBottomRight = bottom || right ? radius : 0;
    const rBottomLeft = bottom || left ? radius : 0;

    if (rightNeighbor) {
      paths.push(`M ${x + size - radius} ${y} H ${x + size + bridgeGap + radius} V ${y + size} H ${x + size - radius} Z`);
    }

    if (bottomNeighbor) {
      paths.push(`M ${x} ${y + size - radius} H ${x + size} V ${y + size + bridgeGap + radius} H ${x} Z`);
    }

    if (rightNeighbor && bottomNeighbor && cells.has(coordKey(row + 1, col + 1))) {
      paths.push(`M ${x + size - radius} ${y + size - radius} H ${x + size + bridgeGap + radius} V ${y + size + bridgeGap + radius} H ${x + size - radius} Z`);
    }

    paths.push([
      `M ${x + rTopLeft} ${y}`,
      `H ${x + size - rTopRight}`,
      rTopRight ? `Q ${x + size} ${y} ${x + size} ${y + rTopRight}` : `L ${x + size} ${y}`,
      `V ${y + size - rBottomRight}`,
      rBottomRight ? `Q ${x + size} ${y + size} ${x + size - rBottomRight} ${y + size}` : `L ${x + size} ${y + size}`,
      `H ${x + rBottomLeft}`,
      rBottomLeft ? `Q ${x} ${y + size} ${x} ${y + size - rBottomLeft}` : `L ${x} ${y + size}`,
      `V ${y + rTopLeft}`,
      rTopLeft ? `Q ${x} ${y} ${x + rTopLeft} ${y}` : `L ${x} ${y}`,
      "Z"
    ].join(" "));
  });

  return paths.join(" ");
}

function PipsTrayDomino({ domino, index, placed, onClick }: { domino: PipsDomino; index: number; placed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg transition ${placed ? "opacity-45 hover:opacity-85" : "hover:-translate-y-0.5 hover:opacity-95"}`}
      aria-label={placed ? `Remove domino ${domino[0]}-${domino[1]}` : `Place domino ${domino[0]}-${domino[1]}`}
    >
      <svg viewBox="0 0 118 56" className="h-14 w-[7.4rem]" aria-hidden>
        <rect x="2" y="2" width="114" height="48" rx="12" fill="#f6f6f6" stroke="#444444" strokeWidth="3" />
        <path d="M 59 9 L 59 43" fill="none" stroke="#e2dbdb" strokeWidth="2" strokeLinecap="round" />
        {[0, 1].map((half) => {
          const centerX = half === 0 ? 30 : 88;
          return pipsDotOffsets(domino[half] ?? 0, 9, 9).map(([dx, dy], dotIndex) => (
            <circle key={`${index}-${half}-${dotIndex}`} cx={centerX + dx} cy={26 + dy} r="4.5" fill="#3f3f3f" />
          ));
        })}
        <path d="M 10 51 H 108" stroke="#9a9a9a" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      </svg>
    </button>
  );
}

function PipsDifficulty({ difficulty, entry }: { difficulty: DifficultyKey; entry: AnyRecord }) {
  const regions = useMemo(() => asPipsRegions(entry.regions), [entry.regions]);
  const dominoes = useMemo(() => (Array.isArray(entry.dominoes) ? entry.dominoes.map(asPipsDomino).filter((domino): domino is PipsDomino => Boolean(domino)) : []), [entry.dominoes]);
  const solution = useMemo(() => asPipsSolution(entry.solution), [entry.solution]);
  const [placedDominoes, setPlacedDominoes] = useState<Set<number>>(() => new Set());
  const puzzleId = asNumber(entry.puzzleId);

  const context = useMemo(() => {
    const occupied = new Set<string>();
    const regionByCell = new Map<string, PipsRegion>();
    const solutionByCell = new Map<string, number>();
    const rows: number[] = [];
    const cols: number[] = [];

    regions.forEach((region) => {
      region.indices.forEach(([row, col]) => {
        occupied.add(coordKey(row, col));
        regionByCell.set(coordKey(row, col), region);
        rows.push(row);
        cols.push(col);
      });
    });

    solution.forEach((pair, index) => {
      pair.forEach(([row, col]) => {
        occupied.add(coordKey(row, col));
        solutionByCell.set(coordKey(row, col), index);
        rows.push(row);
        cols.push(col);
      });
    });

    const maxRow = Math.max(0, ...rows);
    const maxCol = Math.max(0, ...cols);
    const metrics = maxRow >= 7
      ? { cell: 72, gap: 10, boardPad: 14, radius: 15, dashRadius: 15 }
      : maxCol >= 4
        ? { cell: 76, gap: 10, boardPad: 14, radius: 16, dashRadius: 16 }
        : { cell: 82, gap: 10, boardPad: 14, radius: 17, dashRadius: 17 };
    const originX = 30;
    const originY = 30;
    const gridWidth = (maxCol + 1) * metrics.cell + maxCol * metrics.gap;
    const gridHeight = (maxRow + 1) * metrics.cell + maxRow * metrics.gap;

    return {
      occupied,
      regionByCell,
      solutionByCell,
      maxRow,
      maxCol,
      metrics,
      originX,
      originY,
      gridWidth,
      gridHeight,
      svgWidth: originX + gridWidth + 86,
      svgHeight: originY + gridHeight + 86
    };
  }, [regions, solution]);

  function cellTopLeft(row: number, col: number) {
    return {
      x: context.originX + col * (context.metrics.cell + context.metrics.gap),
      y: context.originY + row * (context.metrics.cell + context.metrics.gap)
    };
  }

  function toggleDomino(index: number) {
    setPlacedDominoes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function placeDomino(index: number) {
    setPlacedDominoes((current) => new Set(current).add(index));
  }

  function handleCellAction(index: number | undefined) {
    if (index === undefined) return;
    placeDomino(index);
  }

  function handleSvgKey(event: React.KeyboardEvent<SVGRectElement>, index: number | undefined) {
    if (index === undefined) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      placeDomino(index);
    }
  }

  const allPlaced = solution.length > 0 && placedDominoes.size >= solution.length;
  const outlinePaths: { d: string; stroke: string }[] = [];
  regions.forEach((region) => {
    const palette = region.palette;
    if (!palette) return;
    const sameRegion = new Set(region.indices.map(([row, col]) => coordKey(row, col)));
    region.indices.forEach(([row, col]) => {
      const { x, y } = cellTopLeft(row, col);
      const top = !sameRegion.has(coordKey(row - 1, col));
      const right = !sameRegion.has(coordKey(row, col + 1));
      const bottom = !sameRegion.has(coordKey(row + 1, col));
      const left = !sameRegion.has(coordKey(row, col - 1));
      const rightNeighbor = sameRegion.has(coordKey(row, col + 1));
      const bottomNeighbor = sameRegion.has(coordKey(row + 1, col));
      const r = context.metrics.dashRadius;
      const size = context.metrics.cell;
      const stroke = palette.stroke;
      const addLine = (x1: number, y1: number, x2: number, y2: number) => outlinePaths.push({ d: `M ${x1} ${y1} L ${x2} ${y2}`, stroke });
      const addArc = (x1: number, y1: number, x2: number, y2: number, sweep: 0 | 1) => outlinePaths.push({ d: `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`, stroke });

      if (top) addLine(x + r, y, x + size - r, y);
      if (right) addLine(x + size, y + r, x + size, y + size - r);
      if (bottom) addLine(x + r, y + size, x + size - r, y + size);
      if (left) addLine(x, y + r, x, y + size - r);
      if (top && left) addArc(x + r, y, x, y + r, 0);
      if (top && right) addArc(x + size - r, y, x + size, y + r, 1);
      if (bottom && right) addArc(x + size, y + size - r, x + size - r, y + size, 1);
      if (bottom && left) addArc(x + r, y + size, x, y + size - r, 1);

      if (rightNeighbor) {
        const neighborTop = !sameRegion.has(coordKey(row - 1, col + 1));
        const neighborBottom = !sameRegion.has(coordKey(row + 1, col + 1));
        if (top && neighborTop) addLine(x + size - r, y, x + size + context.metrics.gap + r, y);
        if (bottom && neighborBottom) addLine(x + size - r, y + size, x + size + context.metrics.gap + r, y + size);
      }

      if (bottomNeighbor) {
        const neighborLeft = !sameRegion.has(coordKey(row + 1, col - 1));
        const neighborRight = !sameRegion.has(coordKey(row + 1, col + 1));
        if (left && neighborLeft) addLine(x, y + size - r, x, y + size + context.metrics.gap + r);
        if (right && neighborRight) addLine(x + size, y + size - r, x + size, y + size + context.metrics.gap + r);
      }
    });
  });

  return (
    <section className="space-y-4">
      <style>{`@keyframes pips-pop{0%{opacity:0;transform:scale(.82)}70%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}.pips-domino-enter{animation:pips-pop .26s ease-out;transform-box:fill-box;transform-origin:center}`}</style>
      <div>
        <h3 className="text-xl font-semibold capitalize text-foreground">
          {difficulty} Pips {puzzleId ? <span className="text-muted">#{puzzleId}</span> : null}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Start with the empty clue board. Tap a cell or an available domino to place the matching solved piece.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,34rem)_minmax(16rem,1fr)] xl:items-start">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${context.svgWidth} ${context.svgHeight}`}
            className="h-auto w-full min-w-[18rem] max-w-[30rem]"
            role="img"
            aria-label={`${difficulty} Pips answer board`}
          >
            <path d={pipsCellBackgroundPath(context.occupied, cellTopLeft, context.metrics.cell, context.metrics.gap, context.metrics.radius + 7, 7)} fill="#dbc2b9" />
            {Array.from({ length: (context.maxRow + 1) * (context.maxCol + 1) }, (_, index) => {
              const row = Math.floor(index / (context.maxCol + 1));
              const col = index % (context.maxCol + 1);
              const key = coordKey(row, col);
              if (!context.occupied.has(key)) return null;
              const region = context.regionByCell.get(key);
              const { x, y } = cellTopLeft(row, col);
              return (
                <g key={`cell-${key}`}>
                  <rect x={x} y={y} width={context.metrics.cell} height={context.metrics.cell} rx={context.metrics.radius} fill="#e1cbc5" />
                  {region?.palette ? <rect x={x} y={y} width={context.metrics.cell} height={context.metrics.cell} rx={context.metrics.radius} fill={region.palette.fill} /> : null}
                </g>
              );
            })}
            {outlinePaths.map((path, index) => (
              <path key={`outline-${index}`} d={path.d} fill="none" stroke={path.stroke} strokeWidth="4.5" strokeLinecap="round" strokeDasharray="10 10" />
            ))}
            {regions.map((region, index) => {
              if (!region.palette || region.type === "empty") return null;
              const label = pipsClueLabel(region);
              if (!label) return null;
              const anchor = [...region.indices].sort((a, b) => (a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]))[0];
              if (!anchor) return null;
              const [row, col] = anchor;
              const belowOpen = !context.occupied.has(coordKey(row + 1, col));
              const placement = row === context.maxRow || belowOpen ? "bottom" : "right";
              const { x, y } = cellTopLeft(row, col);
              const centerX = placement === "right" ? x + context.metrics.cell + 18 : x + context.metrics.cell - 18;
              const centerY = placement === "right" ? y + context.metrics.cell - 18 : y + context.metrics.cell + 18;
              return (
                <g key={`badge-${index}`}>
                  <rect x={centerX - 20} y={centerY - 20} width="40" height="40" rx="7" fill={region.palette.badge} transform={`rotate(45 ${centerX} ${centerY})`} />
                  <text x={centerX} y={centerY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={label.length >= 3 ? 18 : label.length === 2 ? 22 : 30} fontWeight="800" fill="#ffffff">
                    {label}
                  </text>
                </g>
              );
            })}
            {Array.from(context.occupied).map((key) => {
              const [row, col] = key.split(",").map(Number);
              const dominoIndex = context.solutionByCell.get(key);
              const { x, y } = cellTopLeft(row, col);
              return (
                <rect
                  key={`hit-${key}`}
                  x={x}
                  y={y}
                  width={context.metrics.cell}
                  height={context.metrics.cell}
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  aria-label={dominoIndex === undefined ? "Pips board cell" : `Place domino ${dominoIndex + 1}`}
                  onClick={() => handleCellAction(dominoIndex)}
                  onKeyDown={(event) => handleSvgKey(event, dominoIndex)}
                />
              );
            })}
            {solution.map((pair, index) => {
              if (!placedDominoes.has(index)) return null;
              const domino = dominoes[index];
              if (!domino) return null;
              const [firstCell, secondCell] = pair;
              const [r1, c1] = firstCell;
              const [r2, c2] = secondCell;
              const firstPos = cellTopLeft(r1, c1);
              const secondPos = cellTopLeft(r2, c2);
              const horizontal = r1 === r2;
              const inset = Math.round(context.metrics.cell * 0.12);
              const x = Math.min(firstPos.x, secondPos.x) + inset;
              const y = Math.min(firstPos.y, secondPos.y) + inset;
              const width = horizontal ? context.metrics.cell * 2 + context.metrics.gap - inset * 2 : context.metrics.cell - inset * 2;
              const height = horizontal ? context.metrics.cell - inset * 2 : context.metrics.cell * 2 + context.metrics.gap - inset * 2;
              const dividerX = horizontal ? Math.min(firstPos.x, secondPos.x) + context.metrics.cell + context.metrics.gap / 2 : null;
              const dividerY = horizontal ? null : Math.min(firstPos.y, secondPos.y) + context.metrics.cell + context.metrics.gap / 2;
              const pipRadius = Math.max(3.5, context.metrics.cell * 0.055);
              const spread = context.metrics.cell * 0.15;
              return (
                <g key={`domino-${index}`} className="pips-domino-enter cursor-pointer" role="button" tabIndex={0} aria-label={`Remove domino ${domino[0]}-${domino[1]}`} onClick={(event) => {
                  event.stopPropagation();
                  toggleDomino(index);
                }} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleDomino(index);
                  }
                }}>
                  <rect x={x} y={y} width={width} height={height} rx={Math.max(11, context.metrics.radius - 3)} fill="#f6f6f6" stroke="#444444" strokeWidth="3" />
                  {horizontal && dividerX !== null ? <path d={`M ${dividerX} ${y + 8} L ${dividerX} ${y + height - 8}`} fill="none" stroke="#e2dbdb" strokeWidth="3" strokeLinecap="round" /> : null}
                  {!horizontal && dividerY !== null ? <path d={`M ${x + 8} ${dividerY} L ${x + width - 8} ${dividerY}`} fill="none" stroke="#e2dbdb" strokeWidth="3" strokeLinecap="round" /> : null}
                  {pair.map(([row, col], halfIndex) => {
                    const centerX = context.originX + col * (context.metrics.cell + context.metrics.gap) + context.metrics.cell / 2;
                    const centerY = context.originY + row * (context.metrics.cell + context.metrics.gap) + context.metrics.cell / 2;
                    return pipsDotOffsets(domino[halfIndex] ?? 0, spread, spread).map(([dx, dy], dotIndex) => (
                      <circle key={`pip-${index}-${halfIndex}-${dotIndex}`} cx={centerX + dx} cy={centerY + dy} r={pipRadius} fill="#2c2c2c" />
                    ));
                  })}
                  <rect x={x} y={y} width={width} height={height} rx={Math.max(11, context.metrics.radius - 3)} fill="transparent" onClick={(event) => {
                    event.stopPropagation();
                    toggleDomino(index);
                  }} />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlacedDominoes(new Set(solution.map((_, index) => index)))}
              disabled={allPlaced}
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Place all
            </button>
            <button
              type="button"
              onClick={() => setPlacedDominoes(new Set())}
              disabled={!placedDominoes.size}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove all
            </button>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {dominoes.map((domino, index) => (
                <PipsTrayDomino key={`${domino[0]}-${domino[1]}-${index}`} domino={domino} index={index} placed={placedDominoes.has(index)} onClick={() => toggleDomino(index)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PipsVisual({ payload }: { payload: AnyRecord }) {
  return (
    <div className="space-y-10">
      {(["easy", "medium", "hard"] as DifficultyKey[]).map((difficulty) => {
        const entry = asRecord(payload[difficulty]);
        return <PipsDifficulty key={difficulty} difficulty={difficulty} entry={entry} />;
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

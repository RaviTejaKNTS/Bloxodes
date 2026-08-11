export const PUZZLE_TIME_ZONE = "America/New_York";

export function formatPuzzleDate(date = new Date(), timeZone = PUZZLE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

export function shiftPuzzleDate(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid puzzle date: ${value}`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function partitionPuzzleAnswersByDate<T extends { answer_date: string }>(
  answers: T[],
  todayDate = formatPuzzleDate()
) {
  const yesterdayDate = shiftPuzzleDate(todayDate, -1);
  const today = answers.find((answer) => answer.answer_date === todayDate) ?? null;
  const yesterday = answers.find((answer) => answer.answer_date === yesterdayDate) ?? null;
  const archive = answers.filter((answer) => answer !== today && answer !== yesterday);

  return { today, yesterday, archive };
}

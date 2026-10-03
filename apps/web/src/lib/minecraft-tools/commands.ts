import { boundedNumber } from "./calculations";
import type { Edition } from "./types";

export type CommandInput = { type: "give" | "teleport" | "effect" | "fill" | "time" | "weather"; target: string; item: string; count: number; x: string; y: string; z: string; x2: string; y2: string; z2: string; seconds: number; amplifier: number; hideParticles: boolean; time: number; weather: "clear" | "rain" | "thunder" };
export function commandCoordinate(value: string) {
  const trimmed = value.trim();
  if (!/^(?:[~^](?:-?(?:\d+(?:\.\d+)?|\.\d+))?|-?(?:\d+(?:\.\d+)?|\.\d+))$/.test(trimmed)) throw new Error("Use a number, ~ relative coordinate, or ^ local coordinate.");
  const numeric = Number(trimmed.replace(/^[~^]/, "") || "0");
  boundedNumber(numeric, "Coordinate", -29_999_984, 29_999_984);
  return trimmed;
}
function coordinates(values: string[], allowLocal = true) {
  const parsed = values.map(commandCoordinate);
  if (parsed.some(v => v.startsWith("^")) && (!allowLocal || !parsed.every(v => v.startsWith("^")))) throw new Error("Local coordinates require all three coordinates to start with ^.");
  return parsed.join(" ");
}
function target(value: string) {
  if (!/^(?:@[spare]|[A-Za-z0-9_]{1,16})$/.test(value)) throw new Error("Use a player name or a basic selector such as @s, @p, or @a.");
  return value;
}
function identifier(value: string, supported: string[] | undefined, kind: string) {
  const id = value.replace(/^minecraft:/, "");
  if (!supported?.includes(id)) throw new Error(`Choose a supported ${kind} for this edition and release.`);
  if (!/^[a-z0-9_]+$/.test(id)) throw new Error("The selected identifier is invalid.");
  return `minecraft:${id}`;
}
export function generateCommand(edition: Edition, input: CommandInput, registry: { items?: string[]; blocks?: string[]; effects?: string[] }) {
  switch (input.type) {
    case "give":
      boundedNumber(input.count, "Item count", 1, edition === "bedrock" ? 32767 : 2304, true);
      return `/give ${target(input.target)} ${identifier(input.item, registry.items, "item")} ${input.count}`;
    case "teleport": return `/tp ${target(input.target)} ${coordinates([input.x, input.y, input.z])}`;
    case "effect":
      boundedNumber(input.seconds, "Effect duration", 1, 1_000_000, true);
      boundedNumber(input.amplifier, "Effect amplifier", 0, 255, true);
      return `/effect ${edition === "java" ? "give " : ""}${target(input.target)} ${identifier(input.item, registry.effects, "effect")} ${input.seconds} ${input.amplifier} ${input.hideParticles}`;
    case "fill": {
      const first = coordinates([input.x, input.y, input.z], false), second = coordinates([input.x2, input.y2, input.z2], false);
      const all = [input.x, input.y, input.z, input.x2, input.y2, input.z2];
      if (all.every(n => !/[~^]/.test(n))) {
        if (all.some(n => !Number.isInteger(Number(n)))) throw new Error("Fill positions must use whole block coordinates.");
        const volume = (Math.abs(Number(input.x2) - Number(input.x)) + 1) * (Math.abs(Number(input.y2) - Number(input.y)) + 1) * (Math.abs(Number(input.z2) - Number(input.z)) + 1);
        if (volume > 32768) throw new Error("This fill exceeds the supported default limit of 32,768 blocks. Split it into smaller regions.");
      }
      return `/fill ${first} ${second} ${identifier(input.item, registry.blocks, "block")} replace`;
    }
    case "time": boundedNumber(input.time, "Time", 0, 24000, true); return `/time set ${input.time}`;
    case "weather":
      if (!["clear", "rain", "thunder"].includes(input.weather)) throw new Error("Select a supported weather state.");
      return `/weather ${input.weather}`;
  }
}

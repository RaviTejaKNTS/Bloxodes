import { describe, expect, it } from "vitest";
import { generateCommand, type CommandInput } from "../commands";
const input: CommandInput = { type: "effect", target: "@s", item: "speed", count: 1, x: "0", y: "64", z: "0", x2: "10", y2: "65", z2: "10", seconds: 30, amplifier: 1, hideParticles: false, time: 1000, weather: "clear" };
const registry = { items: ["diamond"], blocks: ["stone"], effects: ["speed"] };
describe("edition-specific command generation", () => {
 it("uses independent Java and Bedrock effect syntax", () => {
  expect(generateCommand("java", input, registry)).toBe("/effect give @s minecraft:speed 30 1 false");
  expect(generateCommand("bedrock", input, registry)).toBe("/effect @s minecraft:speed 30 1 false");
 });
 it("validates identifiers and selectors without allowing command injection", () => {
  expect(() => generateCommand("java", { ...input, item: "speed\n/kill @a" }, registry)).toThrow("supported");
  expect(() => generateCommand("java", { ...input, target: "@s;kill" }, registry)).toThrow("player name");
 });
 it("supports relative/local teleport coordinates and rejects mixed local forms", () => {
  expect(generateCommand("java", { ...input, type: "teleport", x: "~", y: "~10", z: "~-5" }, registry)).toBe("/tp @s ~ ~10 ~-5");
  expect(() => generateCommand("java", { ...input, type: "teleport", x: "^", y: "~", z: "^5" }, registry)).toThrow("all three");
 });
 it("checks default fill volume and integer positions", () => {
  expect(generateCommand("bedrock", { ...input, type: "fill", item: "stone" }, registry)).toBe("/fill 0 64 0 10 65 10 minecraft:stone replace");
  expect(() => generateCommand("java", { ...input, type: "fill", item: "stone", x2: "2000" }, registry)).toThrow("32,768");
  expect(() => generateCommand("java", { ...input, type: "fill", item: "stone", x: "0.5" }, registry)).toThrow("whole block");
 });
});

import type { BrewingRule, Edition, EquipmentRule, FuelRule, ItemRule } from "./types";

export function boundedNumber(value: number, label: string, min: number, max: number, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${label} must be ${integer ? "a whole number" : "a number"} between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
  }
  return value;
}
export function portalCoordinates(x: number, y: number, z: number, direction: "to-nether" | "to-overworld") {
  boundedNumber(x, "X", -29_999_984, 29_999_984);
  boundedNumber(z, "Z", -29_999_984, 29_999_984);
  boundedNumber(y, "Y", -64, 320);
  const scale = direction === "to-nether" ? 1 / 8 : 8;
  const targetX = x * scale, targetZ = z * scale;
  if (Math.abs(targetX) > 29_999_984 || Math.abs(targetZ) > 29_999_984) throw new Error("The corresponding position is outside the supported world boundary.");
  return { x: targetX, y, z: targetZ, blockX: Math.floor(targetX), blockZ: Math.floor(targetZ) };
}
export function storagePlan(quantity: number, item: ItemRule, slots = 27) {
  boundedNumber(quantity, "Quantity", 0, 1_000_000_000, true);
  boundedNumber(item.stackSize, "Stack size", 1, 64, true);
  boundedNumber(slots, "Container slots", 1, 54, true);
  const occupiedSlots = Math.ceil(quantity / item.stackSize);
  return { fullStacks: Math.floor(quantity / item.stackSize), remainder: quantity % item.stackSize, occupiedSlots, containers: Math.ceil(occupiedSlots / slots), freeSlots: Math.ceil(occupiedSlots / slots) * slots - occupiedSlots };
}
export function furnacePlan(quantity: number, fuel: FuelRule, station: "furnace" | "blast-furnace" | "smoker", furnaces = 1) {
  boundedNumber(quantity, "Item quantity", 0, 1_000_000_000, true);
  boundedNumber(furnaces, "Parallel stations", 1, 256, true);
  boundedNumber(fuel.burnTicks, "Fuel duration", 1, 1_000_000, true);
  const ticksPerItem = station === "furnace" ? 200 : 100;
  // Fast stations consume fuel twice as fast, so capacity per fuel is unchanged.
  const fuelTicks = station === "furnace" ? fuel.burnTicks : fuel.burnTicks / 2;
  const busy = Math.min(quantity, furnaces);
  const each = busy ? Math.floor(quantity / busy) : 0, extra = busy ? quantity % busy : 0;
  const smallerFuel = Math.ceil(each * ticksPerItem / fuelTicks);
  const largerFuel = Math.ceil((each + 1) * ticksPerItem / fuelTicks);
  const fuels = (busy - extra) * smallerFuel + extra * largerFuel;
  return { fuelCount: fuels, capacityPerFuel: fuel.burnTicks / 200, unusedCapacity: fuels * fuel.burnTicks / 200 - quantity, seconds: Math.ceil(quantity / Math.max(1, busy)) * ticksPerItem / 20, stationsUsed: busy, remainderContainers: fuel.remainder ? fuels : 0 };
}
export function circleGrid(diameter: number, filled = false) {
  boundedNumber(diameter, "Diameter", 1, 256, true);
  const center = (diameter - 1) / 2, radius = diameter / 2;
  const disk = Array.from({ length: diameter }, (_, z) => Array.from({ length: diameter }, (_, x) => (x - center) ** 2 + (z - center) ** 2 <= radius ** 2));
  const grid = filled ? disk : disk.map((row, z) => row.map((cell, x) => cell && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !disk[z + dz]?.[x + dx])));
  return { grid, count: grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0) };
}
export function circleSvg(grid: boolean[][]) {
  const n = grid.length;
  const cells = grid.flatMap((row, z) => row.flatMap((cell, x) => cell ? [`<rect x="${x}" y="${z}" width="1" height="1"/>`] : []));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 10}" height="${n * 10}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="white"/><g fill="#166534">${cells.join("")}</g></svg>`;
}
export function xpAtLevel(level: number) {
  boundedNumber(level, "Level", 0, 10000, true);
  if (level <= 16) return level * level + 6 * level;
  if (level <= 31) return 2.5 * level * level - 40.5 * level + 360;
  return 4.5 * level * level - 162.5 * level + 2220;
}
export function xpToNext(level: number) {
  return xpAtLevel(level + 1) - xpAtLevel(level);
}
export function xpPlan(level: number, progress: number, target: number) {
  boundedNumber(level, "Current level", 0, 9999, true);
  boundedNumber(target, "Target level", 0, 10000, true);
  boundedNumber(progress, "Progress percent", 0, 100);
  if (target < level) throw new Error("Target level must be at least your current level.");
  const current = xpAtLevel(level) + Math.floor(xpToNext(level) * progress / 100);
  const needed = Math.max(0, xpAtLevel(target) - current);
  return { currentXp: current, targetXp: xpAtLevel(target), needed, nextLevelXp: xpToNext(level) };
}
export function beaconPlan(layers: number, width = 1, depth = 1) {
  boundedNumber(layers, "Pyramid layers", 1, 4, true);
  boundedNumber(width, "Beacon columns", 1, 6, true);
  boundedNumber(depth, "Beacon rows", 1, 6, true);
  const layerCounts = Array.from({ length: layers }, (_, i) => (width + 2 * (i + 1)) * (depth + 2 * (i + 1)));
  const blocks = layerCounts.reduce((a, b) => a + b, 0);
  return { layerCounts, blocks, mineralItems: blocks * 9, beaconCount: width * depth, glass: width * depth * 5, obsidian: width * depth * 3, netherStars: width * depth };
}
export function buildingPlan(shape: "box" | "room" | "walls" | "floor" | "cylinder", width: number, depth: number, height: number, openings = 0) {
  [width, depth, height].forEach((n, i) => boundedNumber(n, ["Width", "Depth", "Height"][i], 1, 512, true));
  let blocks: number;
  if (shape === "box") blocks = width * depth * height;
  else if (shape === "floor") blocks = width * depth;
  else if (shape === "room") blocks = width * depth * height - Math.max(0, width - 2) * Math.max(0, depth - 2) * Math.max(0, height - 2);
  else if (shape === "walls") blocks = (width * depth - Math.max(0, width - 2) * Math.max(0, depth - 2)) * height;
  else {
    if (width > 256) throw new Error("Cylinder diameter must be at most 256 blocks.");
    blocks = circleGrid(width).count * height;
  }
  boundedNumber(openings, "Removed blocks", 0, blocks, true);
  return { blocks: blocks - openings, stacks64: Math.floor((blocks - openings) / 64), remaining64: (blocks - openings) % 64 };
}
export function brewingPlan(rule: BrewingRule, form: "drink" | "splash" | "lingering", modifier: "normal" | "extended" | "strong", bottles: number) {
  boundedNumber(bottles, "Potion bottles", 1, 1_000_000, true);
  const steps = [...rule.steps];
  if (modifier === "extended") {
    if (!rule.extend) throw new Error("This potion does not support a longer-duration variant.");
    steps.push({ ingredient: "redstone", result: rule.extend });
  }
  if (modifier === "strong") {
    if (!rule.enhance) throw new Error("This potion does not support a stronger variant.");
    steps.push({ ingredient: "glowstone_dust", result: rule.enhance });
  }
  if (form !== "drink") steps.push({ ingredient: "gunpowder", result: "Splash form" });
  if (form === "lingering") steps.push({ ingredient: "dragon_breath", result: "Lingering form" });
  const batches = Math.ceil(bottles / 3), operations = batches * steps.length;
  const ingredients: Record<string, number> = { glass_bottle: bottles };
  steps.forEach(step => { ingredients[step.ingredient] = (ingredients[step.ingredient] ?? 0) + batches; });
  const blazePowder = Math.ceil(operations / 20);
  if (blazePowder) ingredients.blaze_powder = (ingredients.blaze_powder ?? 0) + blazePowder;
  return { steps, ingredients, batches, blazePowder, operations, seconds: operations * 20 };
}
export function compareEquipment(rows: EquipmentRule[], edition: Edition) {
  return rows.map(row => ({ ...row, ...row.editionStats?.[edition] }));
}
export type Bearing = { x: number; z: number; yaw: number };
function intersection(a: Bearing, b: Bearing) {
  const da = { x: -Math.sin(a.yaw * Math.PI / 180), z: Math.cos(a.yaw * Math.PI / 180) };
  const db = { x: -Math.sin(b.yaw * Math.PI / 180), z: Math.cos(b.yaw * Math.PI / 180) };
  const cross = da.x * db.z - da.z * db.x;
  if (Math.abs(cross) < Math.sin(Math.PI / 180)) throw new Error("Bearings are within one degree of parallel. Take another observation farther to the side.");
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = (dx * db.z - dz * db.x) / cross;
  const u = (dx * da.z - dz * da.x) / cross;
  if (t <= 0 || u <= 0) throw new Error("The bearings intersect behind an observation. Check yaw signs and take observations toward the same stronghold.");
  return { x: a.x + t * da.x, z: a.z + t * da.z, distanceA: t, distanceB: u };
}
export function triangulate(a: Bearing, b: Bearing, errorDegrees: number) {
  for (const p of [a, b]) {
    boundedNumber(p.x, "Observation X", -29_999_984, 29_999_984);
    boundedNumber(p.z, "Observation Z", -29_999_984, 29_999_984);
    boundedNumber(p.yaw, "Yaw", -180, 180);
  }
  boundedNumber(errorDegrees, "Bearing error", 0.01, 5);
  if (Math.hypot(a.x - b.x, a.z - b.z) < 1) throw new Error("Use two different observation positions at least one block apart.");
  const point = intersection(a, b);
  const angle = ((a.yaw - b.yaw) % 180 + 180) % 180;
  const crossesParallel = Math.min(angle, 180 - angle) <= 2 * errorDegrees;
  if (Math.abs(point.x) > 29_999_984 || Math.abs(point.z) > 29_999_984) throw new Error("The intersection is outside the supported world boundary.");
  const corners = [-1, 1].flatMap(sa => [-1, 1].map(sb => {
    try { return intersection({ ...a, yaw: a.yaw + sa * errorDegrees }, { ...b, yaw: b.yaw + sb * errorDegrees }); } catch { return null; }
  }));
  const points = corners.filter((p): p is NonNullable<typeof p> => p !== null);
  const unstable = crossesParallel || points.length !== 4;
  return { ...point, unstable, uncertainty: unstable ? null : { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) } };
}

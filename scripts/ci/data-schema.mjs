import fs from "node:fs";

export const schemaManifest = JSON.parse(fs.readFileSync(new URL("./fixtures/schema.json", import.meta.url), "utf8"));
// Relation payloads are not columns and never appear in SELECT *.
const embeds = new WeakMap();
export const setEmbeds = (row, relations) => { embeds.set(row, relations); return row; };
export const getEmbeds = row => embeds.get(row) ?? {};

export function rowContract(columns) {
  if (!columns || Array.isArray(columns)) throw new Error("CI queries require explicit schema column types.");
  return { columns: new Set(Object.keys(columns)), types: columns, relations: {} };
}
export function tableContract(table) {
  const definition = schemaManifest.tables[table];
  if (!definition) throw new Error(`No CI schema manifest table: ${table}`);
  return rowContract(definition.columns);
}
// Copying a base row into a view (or the reverse) is an explicit schema mapping.
// New rows and override keys still pass through validateSeedRows unchanged.
export function copyColumns(table, source) {
  return Object.fromEntries(Object.keys(schemaManifest.tables[table].columns).filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
}
export function validateSeedRows(tables) {
  for (const [table, rows] of Object.entries(tables)) {
    if (schemaManifest.absentTables.includes(table)) {
      if (rows.length) throw new Error(`CI fixture seeds absent table ${table}`);
      continue;
    }
    const contract = tableContract(table);
    for (const [index, row] of rows.entries()) for (const key of Object.keys(row)) {
      if (!contract.columns.has(key)) throw new Error(`Unknown CI seed column ${table}.${key} at row ${index}`);
    }
  }
}
export function rpcContract(name, args) {
  const definitions = schemaManifest.rpcs[name];
  if (!definitions) throw new Error(`No CI schema manifest RPC: ${name}`);
  const definition = definitions.find(definition => {
    const inputs = definition.arguments.filter(arg => ["i", "b"].includes(arg.mode));
    return Object.keys(args).every(key => inputs.some(arg => arg.name === key)) &&
      inputs.slice(0, inputs.length - definition.defaults).every(arg => Object.hasOwn(args, arg.name));
  });
  if (!definition) throw new Error(`Unknown or missing CI RPC arguments: ${name}`);
  for (const arg of definition.arguments.filter(arg => ["i", "b"].includes(arg.mode))) {
    if (args[arg.name] != null) typedValue(typeof args[arg.name] === "string" ? args[arg.name] : JSON.stringify(args[arg.name]), arg.type);
  }
  const outputs = definition.arguments.filter(arg => ["t", "o", "b"].includes(arg.mode));
  return outputs.length ? rowContract(Object.fromEntries(outputs.map(arg => [arg.name, {type:arg.type}]))) : null;
}
export function validateRpcSamples(rpcs) {
  for (const [name, rows] of Object.entries(rpcs)) {
    const definitions = schemaManifest.rpcs[name];
    if (!definitions) throw new Error(`No CI schema manifest RPC: ${name}`);
    const outputs = new Set(definitions.flatMap(definition => definition.arguments.filter(arg => ["t", "o", "b"].includes(arg.mode)).map(arg => arg.name)));
    if (outputs.size) for (const row of rows) for (const key of Object.keys(row)) {
      if (!outputs.has(key)) throw new Error(`Unknown CI RPC seed column ${name}.${key}`);
    }
  }
}

export function columnKind(type) {
  if (type.endsWith("[]")) return "array";
  if (["smallint", "integer", "bigint"].includes(type)) return "integer";
  if (/^(numeric|decimal|real|double precision)(\(|$)/.test(type)) return "numeric";
  if (type === "boolean") return "boolean";
  if (type === "date") return "date";
  if (type.startsWith("timestamp")) return "timestamp";
  if (type === "uuid") return "uuid";
  if (["json", "jsonb"].includes(type)) return "json";
  if (/^(text|character varying|character)(\(|$)/.test(type)) return "text";
  throw new Error(`Unimplemented CI schema type: ${type}`);
}
export function typedValue(value, type) {
  const kind = columnKind(type);
  const invalid = () => { throw new Error(`Invalid CI data ${type} value: ${value}`); };
  if (typeof value !== "string") return invalid();
  switch (kind) {
    case "integer": {
      if (!/^[+-]?\d+$/.test(value)) return invalid();
      const parsed = BigInt(value);
      const [min, max] = type === "smallint" ? [-32768n, 32767n] : type === "integer" ? [-2147483648n, 2147483647n] : [-9223372036854775808n, 9223372036854775807n];
      if (parsed < min || parsed > max) return invalid();
      return parsed;
    }
    case "numeric":
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) return invalid();
      return Number(value);
    case "boolean":
      if (!["true", "false"].includes(value)) return invalid();
      return value === "true";
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return invalid();
      return value;
    }
    case "timestamp": {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i);
      if (!match || +match[2] > 23 || +match[3] > 59 || +match[4] > 59) return invalid();
      typedValue(match[1], "date");
      const parsed = Date.parse(/[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(value.slice(10)) ? value : value + "Z");
      if (!Number.isFinite(parsed)) return invalid();
      return parsed;
    }
    case "uuid":
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return invalid();
      return value.toLowerCase();
    case "json":
      try { return JSON.parse(value); } catch { return invalid(); }
    case "text": return value;
    default: throw new Error(`Unimplemented CI typed value: ${type}`);
  }
}

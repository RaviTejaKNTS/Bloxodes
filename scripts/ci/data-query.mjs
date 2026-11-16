import { isDeepStrictEqual } from "node:util";
import { columnKind, typedValue } from "./data-schema.mjs";
export { rowContract } from "./data-schema.mjs";

// The PostgREST subset used by public readers. Compile every clause before reading rows.
export function splitTerms(value) {
  const terms = [], stack = [];
  let start = 0, quoted = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quoted && char === "\\") { index++; continue; }
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if ("({[".includes(char)) stack.push(char);
    if (")}]".includes(char) && stack.pop() !== ({")":"(","}":"{","]":"["})[char]) throw new Error(`Invalid CI query syntax: ${value}`);
    if (char === "," && !stack.length) { terms.push(value.slice(start, index).trim()); start = index + 1; }
  }
  terms.push(value.slice(start).trim());
  if (quoted || stack.length || terms.some(term => !term)) throw new Error(`Invalid CI query syntax: ${value}`);
  return terms;
}
const identifier = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
const unquote = value => {
  if (!value.startsWith('"')) {
    if (/["(),{}]/.test(value)) throw new Error(`Invalid CI query value: ${value}`);
    return value;
  }
  const parsed = JSON.parse(value);
  if (typeof parsed !== "string") throw new Error(`Invalid CI query value: ${value}`);
  return parsed;
};
const field = (row, key) => key.split(/->>?/).reduce((value, part) => value?.[part], row);
function validateField(key, contract) {
  const [column, ...path] = key.split(/->>?/);
  if (!identifier.test(column) || path.some(part => !/^[a-zA-Z_0-9]+$/.test(part))) throw new Error(`Invalid CI data field: ${key}`);
  if (!contract.columns.has(column)) throw new Error(`Unknown CI data column: ${column}`);
  if (/->>\w+->/.test(key)) throw new Error(`Invalid CI data JSON path: ${key}`);
  const type = contract.types[column].type;
  if (path.length && !["json", "array"].includes(columnKind(type))) throw new Error(`JSON path on incompatible CI data column: ${column}`);
  return path.length ? (key.includes("->>") ? "text" : "jsonb") : type;
}
const contains = (actual, expected) => {
  if (Array.isArray(actual)) return Array.isArray(expected)
    ? expected.every(item => actual.some(value => contains(value, item)))
    : actual.some(item => isDeepStrictEqual(item, expected));
  if (actual && expected && typeof actual === "object" && typeof expected === "object" && !Array.isArray(expected)) {
    return Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key) && contains(actual[key], value));
  }
  return isDeepStrictEqual(actual, expected);
};
function arrayValue(raw, type) {
  if (!raw.startsWith("{") || !raw.endsWith("}")) throw new Error(`Invalid CI data array: ${raw}`);
  return raw.length === 2 ? [] : splitTerms(raw.slice(1, -1)).map(item => typedValue(unquote(item), type.slice(0, -2)));
}
function compileFilter(column, expression, contract) {
  const type = validateField(column, contract), kind = columnKind(type);
  const match = expression.match(/^([a-z]+)\.(.*)$/s);
  if (!match) throw new Error(`Invalid CI data filter: ${expression}`);
  const [, operator, raw] = match;
  if (operator === "not") {
    const predicate = compileFilter(column, raw, contract);
    return row => (raw.startsWith("is.") || field(row, column) != null) && !predicate(row);
  }
  if (!["is", "eq", "neq", "gt", "gte", "lt", "lte", "in", "like", "ilike", "ov", "cs", "cd"].includes(operator)) throw new Error(`Unimplemented CI data filter: ${operator}`);
  if ((["like", "ilike"].includes(operator) && kind !== "text") ||
      (["cs", "cd"].includes(operator) && !["array", "json"].includes(kind)) ||
      (operator === "ov" && kind !== "array") ||
      (["gt", "gte", "lt", "lte"].includes(operator) && !["integer", "numeric", "text", "date", "timestamp", "uuid"].includes(kind))) {
    throw new Error(`Incompatible CI data operator ${operator} for ${type}`);
  }
  const parse = value => kind === "array" ? arrayValue(value, type) : typedValue(kind === "json" ? value : unquote(value), type);
  let values, value, pattern;
  if (operator === "in") {
    if (!raw.startsWith("(") || !raw.endsWith(")")) throw new Error(`Invalid CI data in list: ${raw}`);
    values = raw.length === 2 ? [] : splitTerms(raw.slice(1, -1)).map(parse);
  } else if (operator === "is") {
    value = unquote(raw);
    if (value !== "null" && (kind !== "boolean" || !["true", "false"].includes(value))) throw new Error(`Invalid CI data is value for ${type}: ${raw}`);
  } else {
    value = parse(raw);
    if (["like", "ilike"].includes(operator)) {
      let source = "";
      for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (char === "\\" && index + 1 < value.length) source += value[++index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        else if (char === "%" || char === "*") source += ".*";
        else if (char === "_") source += ".";
        else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      pattern = new RegExp(`^${source}$`, operator === "ilike" ? "is" : "s");
    }
  }
  const actualValue = actual => {
    if (kind === "array") return actual.map(item => typedValue(String(item), type.slice(0, -2)));
    if (kind === "json") return actual;
    return typedValue(typeof actual === "object" ? JSON.stringify(actual) : String(actual), type);
  };
  return row => {
    const actual = field(row, column);
    if (operator === "is") return value === "null" ? actual == null : actual === (value === "true");
    if (actual == null) return false;
    const comparable = actualValue(actual);
    switch (operator) {
      case "eq": return isDeepStrictEqual(comparable, value);
      case "neq": return !isDeepStrictEqual(comparable, value);
      case "gt": return comparable > value;
      case "gte": return comparable >= value;
      case "lt": return comparable < value;
      case "lte": return comparable <= value;
      case "in": return values.some(value => isDeepStrictEqual(comparable, value));
      case "like": case "ilike": return pattern.test(comparable);
      case "ov": return value.some(item => comparable.some(actual => isDeepStrictEqual(actual, item)));
      case "cs": return contains(comparable, value);
      case "cd": return contains(value, comparable);
    }
  };
}
function compileLogic(term, contract) {
  const group = term.match(/^(not\.)?(and|or)\((.*)\)$/s);
  if (group) {
    const predicates = splitTerms(group[3]).map(part => compileLogic(part, contract));
    return row => {
      const result = group[2] === "and" ? predicates.every(predicate => predicate(row)) : predicates.some(predicate => predicate(row));
      return group[1] ? !result : result;
    };
  }
  const dot = term.indexOf(".");
  if (dot < 1) throw new Error(`Invalid CI data logic: ${term}`);
  return compileFilter(term.slice(0, dot), term.slice(dot + 1), contract);
}
function compileProjection(select, contract) {
  const projections = splitTerms(select).map(part => {
    if (part === "*") return row => Object.fromEntries([...contract.columns].map(key => [key, row[key] ?? null]));
    const embed = part.match(/^(?:(\w+):)?(\w+)\((.*)\)$/s);
    if (embed) {
      const [, alias, target, nested] = embed;
      const relation = contract.relations[target];
      if (!relation) throw new Error(`Unknown CI data relation: ${target}`);
      const project = compileProjection(nested, relation.contract);
      return row => {
        const value = relation.read(row);
        return { [alias ?? target]: Array.isArray(value) ? value.map(project) : value == null ? null : project(value) };
      };
    }
    const match = part.match(/^(?:(\w+):)?([\w]+(?:(?:->>|->)[\w]+)*)$/);
    if (!match) throw new Error(`Invalid CI data projection: ${part}`);
    const [, alias, target] = match;
    validateField(target, contract);
    return row => ({ [alias ?? target.split(/->>?/).at(-1)]: field(row, target) ?? null });
  });
  return row => Object.assign({}, ...projections.map(project => project(row)));
}
function integer(value, name) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error(`Invalid CI data ${name}: ${value}`);
  return Number(value);
}
export function queryRows(tableRows, params, { range, count = false, contract } = {}) {
  if (!contract) throw new Error("CI queries require a schema manifest contract.");
  const predicates = [], orders = [];
  // Compilation cannot depend on row count, filter order or boolean short circuits.
  const project = compileProjection(params.get("select") ?? "*", contract);
  for (const name of ["select", "order", "limit", "offset"]) {
    if (params.getAll(name).length > 1) throw new Error(`Duplicate CI data parameter: ${name}`);
  }
  for (const [column, expression] of params) {
    if (["select", "order", "limit", "offset"].includes(column)) continue;
    if (["or", "and", "not.or", "not.and"].includes(column)) {
      if (!expression.startsWith("(") || !expression.endsWith(")")) throw new Error(`Invalid CI data logic: ${expression}`);
      predicates.push(compileLogic(`${column}${expression}`, contract));
    } else predicates.push(compileFilter(column, expression, contract));
  }
  if (params.has("order")) for (const term of splitTerms(params.get("order"))) {
    const match = term.match(/^([\w]+(?:(?:->>|->)[\w]+)*)(?:\.(asc|desc))?(?:\.(nullsfirst|nullslast))?$/);
    if (!match) throw new Error(`Invalid CI data order: ${term}`);
    validateField(match[1], contract);
    orders.push(match.slice(1));
  }
  const offset = integer(params.get("offset") ?? range?.[0] ?? 0, "offset");
  const limit = integer(params.get("limit") ?? (range ? range[1] - range[0] + 1 : tableRows.length), "limit");
  let rows = tableRows.filter(row => predicates.every(predicate => predicate(row)));
  const total = rows.length;
  rows.sort((a, b) => {
    for (const [column, direction, nulls] of orders) {
      const av = field(a, column), bv = field(b, column);
      if (av === bv) continue;
      const nullsFirst = nulls ? nulls === "nullsfirst" : direction === "desc";
      if (av == null) return nullsFirst ? -1 : 1;
      if (bv == null) return nullsFirst ? 1 : -1;
      return (av < bv ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
  if (count && offset > 0 && offset >= total) return { data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable", details: `An offset of ${offset} was requested, but there are only ${total} rows.`, hint: null } };
  return { data: rows.slice(offset, offset + limit).map(project), count: total, error: null };
}

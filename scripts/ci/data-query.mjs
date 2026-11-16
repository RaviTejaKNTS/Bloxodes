// The small PostgREST subset used by public page readers. Unknown syntax fails.
export function splitTerms(value) {
  const terms = [];
  let start = 0, depth = 0, quoted = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quoted && char === "\\") { index++; continue; }
    if (char === '"') quoted = !quoted;
    if (!quoted) {
      if ("({".includes(char)) depth++;
      if (")}".includes(char)) depth--;
      if (char === "," && depth === 0) { terms.push(value.slice(start, index)); start = index + 1; }
    }
  }
  terms.push(value.slice(start));
  return terms.filter(Boolean);
}
const unquote = value => value.startsWith('"') ? JSON.parse(value) : value;
const field = (row, key) => key.split(/->>?|\./).reduce((value, part) => value?.[part], row);
function matches(row, column, expression) {
  const dot = expression.indexOf(".");
  const operator = expression.slice(0, dot), value = expression.slice(dot + 1);
  const actual = field(row, column);
  const comparable = typeof actual === "number" ? Number(value) : unquote(value);
  switch (operator) {
    case "not": return !matches(row, column, value);
    case "is": return value === "null" ? actual == null : String(actual) === value;
    case "eq": return actual != null && String(actual) === unquote(value);
    case "neq": return actual != null && String(actual) !== unquote(value);
    case "gt": return actual != null && actual > comparable;
    case "gte": return actual != null && actual >= comparable;
    case "lt": return actual != null && actual < comparable;
    case "lte": return actual != null && actual <= comparable;
    case "in": return actual != null && splitTerms(value.slice(1, -1)).map(unquote).includes(String(actual));
    case "like":
    case "ilike": {
      const patternValue = unquote(value);
      let pattern = "";
      for (let index = 0; index < patternValue.length; index++) {
        const char = patternValue[index];
        if (char === "\\" && index + 1 < patternValue.length) pattern += patternValue[++index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        else if (char === "%" || char === "*") pattern += ".*";
        else if (char === "_") pattern += ".";
        else pattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      return new RegExp(`^${pattern}$`, operator === "ilike" ? "is" : "s").test(String(actual ?? ""));
    }
    case "ov": return splitTerms(value.slice(1, -1)).some(item => actual?.includes(unquote(item)));
    case "cs": return splitTerms(value.slice(1, -1)).every(item => actual?.includes(unquote(item)));
    default: throw new Error(`Unimplemented CI data filter: ${operator}`);
  }
}
function logic(row, term) {
  const group = term.match(/^(and|or)\((.*)\)$/s);
  if (group) return group[1] === "and" ? splitTerms(group[2]).every(part => logic(row, part)) : splitTerms(group[2]).some(part => logic(row, part));
  const dot = term.indexOf(".");
  return matches(row, term.slice(0, dot), term.slice(dot + 1));
}
export function project(row, select = "*") {
  const result = {};
  for (const part of splitTerms(select)) {
    if (part === "*") { Object.assign(result, row); continue; }
    const embed = part.match(/^([^()]+)\((.*)\)$/s);
    if (embed) {
      const [alias, target] = embed[1].split(":");
      const value = row[alias] ?? row[(target ?? alias).split("!")[0]] ?? null;
      result[alias.split("!")[0]] = Array.isArray(value) ? value.map(item => project(item, embed[2])) : value && project(value, embed[2]);
    } else {
      const [alias, target] = part.split(":");
      result[alias] = field(row, target ?? alias) ?? null;
    }
  }
  return result;
}
export function queryRows(tableRows, params, { range, count = false } = {}) {
  let rows = [...tableRows];
  for (const [column, expression] of params) {
    if (["select", "order", "limit", "offset"].includes(column)) continue;
    if (column === "or" || column === "and") {
      rows = rows.filter(row => logic(row, `${column}${expression}`));
    } else rows = rows.filter(row => matches(row, column, expression));
  }
  const total = rows.length;
  const orders = (params.get("order") ?? "").split(",").filter(Boolean).map(value => value.split("."));
  rows.sort((a, b) => {
    for (const [column, direction, nulls] of orders) {
      const av = field(a, column), bv = field(b, column);
      if (av === bv) continue;
      if (av == null) return nulls === "nullsfirst" ? -1 : 1;
      if (bv == null) return nulls === "nullsfirst" ? 1 : -1;
      const comparison = av < bv ? -1 : 1;
      return direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
  const offset = Number(params.get("offset") ?? range?.[0] ?? 0);
  const limit = Number(params.get("limit") ?? (range ? range[1] - range[0] + 1 : rows.length));
  if (count && offset > 0 && offset >= total) return { data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable", details: `An offset of ${offset} was requested, but there are only ${total} rows.`, hint: null } };
  return { data: rows.slice(offset, offset + limit).map(row => project(row, params.get("select") ?? "*")), count: total, error: null };
}

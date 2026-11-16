// The PostgREST subset used by public readers. Compile every clause before reading rows.
export function splitTerms(value) {
  const terms = [], stack = [];
  let start = 0, quoted = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quoted && char === "\\") { index++; continue; }
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if ("({".includes(char)) stack.push(char);
    if (")}".includes(char) && stack.pop() !== (char === ")" ? "(" : "{")) throw new Error(`Invalid CI query syntax: ${value}`);
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
export function rowContract(rows, columns = []) {
  return { columns: new Set([...columns, ...rows.flatMap(row => Object.keys(row))]), relations: {} };
}
function validateField(key, contract) {
  const [column, ...path] = key.split(/->>?/);
  if (!identifier.test(column) || path.some(part => !/^[a-zA-Z_0-9]+$/.test(part))) throw new Error(`Invalid CI data field: ${key}`);
  if (!contract.columns.has(column)) throw new Error(`Unknown CI data column: ${column}`);
  return key;
}
function compileFilter(column, expression, contract) {
  validateField(column, contract);
  const match = expression.match(/^([a-z]+)\.(.*)$/s);
  if (!match) throw new Error(`Invalid CI data filter: ${expression}`);
  const [, operator, raw] = match;
  if (operator === "not") {
    const predicate = compileFilter(column, raw, contract);
    return row => !predicate(row);
  }
  if (!["is", "eq", "neq", "gt", "gte", "lt", "lte", "in", "like", "ilike", "ov", "cs"].includes(operator)) throw new Error(`Unimplemented CI data filter: ${operator}`);
  let values, value, pattern;
  if (["in", "ov", "cs"].includes(operator)) {
    const open = operator === "in" ? "(" : "{";
    const close = operator === "in" ? ")" : "}";
    if (!raw.startsWith(open) || !raw.endsWith(close)) throw new Error(`Invalid CI data ${operator} list: ${raw}`);
    values = raw.length === 2 ? [] : splitTerms(raw.slice(1, -1)).map(unquote);
  } else {
    value = unquote(raw);
    if (operator === "is" && !["null", "true", "false"].includes(value)) throw new Error(`Invalid CI data is value: ${raw}`);
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
  return row => {
    const actual = field(row, column);
    const comparable = typeof actual === "number" ? Number(value) : value;
    switch (operator) {
      case "is": return value === "null" ? actual == null : String(actual) === value;
      case "eq": return actual != null && String(actual) === value;
      case "neq": return actual != null && String(actual) !== value;
      case "gt": return actual != null && actual > comparable;
      case "gte": return actual != null && actual >= comparable;
      case "lt": return actual != null && actual < comparable;
      case "lte": return actual != null && actual <= comparable;
      case "in": return actual != null && values.includes(String(actual));
      case "like": case "ilike": return actual != null && pattern.test(String(actual));
      case "ov": return Array.isArray(actual) && values.some(item => actual.includes(item));
      case "cs": return Array.isArray(actual) && values.every(item => actual.includes(item));
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
    if (part === "*") return row => row;
    const embed = part.match(/^(?:(\w+):)?(\w+)\((.*)\)$/s);
    if (embed) {
      const [, alias, target, nested] = embed;
      const relation = contract.relations[target];
      if (!relation) throw new Error(`Unknown CI data relation: ${target}`);
      const project = compileProjection(nested, relation.contract);
      return row => {
        const value = row[relation.key];
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
export function queryRows(tableRows, params, { range, count = false, contract = rowContract(tableRows) } = {}) {
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

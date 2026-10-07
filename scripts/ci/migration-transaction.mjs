// Read top-level statements without treating quoted function bodies as SQL commands.
export function migrationBody(input) {
  const statements = [];
  let start = 0, code = "", i = 0;
  while (i < input.length) {
    if (input.startsWith("--", i)) {
      const end = input.indexOf("\n", i + 2);
      i = end < 0 ? input.length : end;
      code += " "; continue;
    }
    if (input.startsWith("/*", i)) {
      let depth = 1; i += 2;
      while (i < input.length && depth) {
        if (input.startsWith("/*", i)) { depth++; i += 2; }
        else if (input.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error("Unterminated SQL comment.");
      code += " "; continue;
    }
    const quote = input[i];
    if (quote === "'" || quote === '"') {
      const escape = quote === "'" && /[eE]/.test(input[i - 1] ?? "") && !/[a-zA-Z0-9_]/.test(input[i - 2] ?? "");
      i++; let closed = false;
      while (i < input.length) {
        if (escape && input[i] === "\\") { i += 2; continue; }
        if (input[i] === quote) {
          if (input[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) throw new Error("Unterminated SQL quote.");
      code += " quoted "; continue;
    }
    const dollar = input.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
    if (dollar) {
      const end = input.indexOf(dollar, i + dollar.length);
      if (end < 0) throw new Error("Unterminated SQL function body.");
      i = end + dollar.length; code += " quoted "; continue;
    }
    if (input[i] === ";") {
      if (code.trim()) statements.push({ sql: input.slice(start, i + 1), code: code.trim().replace(/\s+/g, " ").toLowerCase() });
      start = ++i; code = ""; continue;
    }
    code += input[i++];
  }
  if (code.trim()) statements.push({sql: input.slice(start), code: code.trim().replace(/\s+/g, " ").toLowerCase()});
  if (/^(begin|begin work|begin transaction|start transaction)$/.test(statements[0]?.code ?? "")) statements.shift();
  if (/^(commit|commit work|commit transaction|end|end work|end transaction)$/.test(statements.at(-1)?.code ?? "")) statements.pop();
  for (const statement of statements) if (/^(begin|start transaction|commit|rollback|end|abort|prepare transaction|savepoint|release savepoint)\b/.test(statement.code)) throw new Error("Migration contains an internal transaction command. The CI publisher owns the transaction.");
  return statements.map(statement => statement.sql).join("\n");
}

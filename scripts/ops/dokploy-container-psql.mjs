import WebSocket from "ws";

const baseUrl = process.env.DOKPLOY_PUBLIC_URL?.trim();
const apiKey = process.env.DOKPLOY_API_CLI_KEY?.trim();
const tuplesOnly = process.argv.includes("--tuples-only");
if (!baseUrl || !apiKey) {
  throw new Error("DOKPLOY_PUBLIC_URL and DOKPLOY_API_CLI_KEY are required for Dokploy transport.");
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const sql = Buffer.concat(chunks).toString("utf8");
if (!sql.trim()) throw new Error("SQL input is required.");

const url = new URL(baseUrl);
url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
url.pathname = "/docker-container-terminal";
url.search = new URLSearchParams({
  containerId: "supabase-db",
  activeWay: "sh",
  cols: "160",
  rows: "40",
}).toString();

const beginMarker = "__BLOXODES_PSQL_BEGIN__";
const endMarker = "__BLOXODES_PSQL_END__";
const psqlFlags = tuplesOnly ? "-A -t" : "";
const encodedSql = Buffer.from(sql, "utf8").toString("base64");
const command = [
  `printf '\\n${beginMarker}\\n'`,
  `printf '%s' '${encodedSql}' | base64 -d | psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 ${psqlFlags}`,
  "code=$?",
  `printf '\\n${endMarker}%s\\n' "$code"`,
  "exit",
].join("; ");

let output = "";
let settled = false;
const ws = new WebSocket(url, { headers: { "x-api-key": apiKey } });

const finish = (error) => {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  if (ws.readyState === WebSocket.OPEN) ws.close();
  if (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  const clean = output.replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, "").replaceAll("\r", "");
  const start = clean.indexOf(beginMarker);
  const end = clean.indexOf(endMarker, start + beginMarker.length);
  const statusMatch = clean.slice(end).match(new RegExp(`${endMarker}(\\d+)`));
  if (start === -1 || end === -1 || !statusMatch) {
    process.stderr.write("Dokploy psql transport returned incomplete output.\n");
    process.exitCode = 1;
    return;
  }
  const body = clean.slice(start + beginMarker.length, end).replace(/^\n|\n$/g, "");
  if (body) process.stdout.write(`${body}\n`);
  const status = Number(statusMatch[1]);
  if (status !== 0) process.exitCode = status;
};

const timeout = setTimeout(() => finish(new Error("Dokploy psql transport timed out.")), 120000);
ws.on("open", () => {
  setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send("stty -echo\n");
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(`${command}\n`);
    }, 400);
  }, 1200);
});
ws.on("message", (chunk) => {
  output += chunk.toString();
  if (output.includes(endMarker)) finish();
});
ws.on("error", (error) => finish(error));
ws.on("close", () => {
  if (!settled) finish(new Error("Dokploy psql transport closed before completion."));
});

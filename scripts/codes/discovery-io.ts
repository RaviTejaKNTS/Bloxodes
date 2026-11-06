import { OperationalDiscoveryError, ResolutionError, queueDecision } from "./discovery-model";
import { setTimeout as delay } from "node:timers/promises";

export class FatalDiscoveryError extends Error {}
export function makeRequest(deadline: AbortSignal, fetcher: typeof fetch = fetch, wait: (ms: number) => Promise<unknown> = ms => delay(ms, undefined, { signal: deadline })) {
  return async (url: string, init: RequestInit = {}, fatal = false): Promise<string> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await wait(350);
      try {
        const response = await fetcher(url, { ...init, headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Bloxodes/1.0",
          ...init.headers }, signal: AbortSignal.any([deadline, AbortSignal.timeout(20_000)]) });
        if (response.ok) return await response.text();
        if ([400,401,403,404].includes(response.status) && url.includes("api.notion.com")) throw new FatalDiscoveryError(`Notion configuration/auth failure (${response.status})`);
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
          throw new ResolutionError(`Wrong page: HTTP ${response.status}`);
        }
        if (attempt === 2) throw new OperationalDiscoveryError(`HTTP ${response.status}`);
        await wait(Math.min(30_000, Number(response.headers.get("retry-after") || 1) * 1000));
      } catch (error) {
        if (error instanceof FatalDiscoveryError || error instanceof ResolutionError || deadline.aborted) throw error;
        if (attempt === 2) {
          const cause = error instanceof OperationalDiscoveryError ? error.message : "network error or timeout";
          const message = `Request failed (${cause}): ${new URL(url).hostname}${new URL(url).pathname}`;
          throw fatal ? new FatalDiscoveryError(message) : new OperationalDiscoveryError(message);
        }
      }
    }
    throw new Error("Unreachable");
  };
}
export class CodesQueue {
  constructor(private request: ReturnType<typeof makeRequest>, private token: string,
    readonly source = process.env.NOTION_CODES_QUEUE_DATA_SOURCE_ID || "257a3425-d4f8-44c1-af56-4ac96a5bed07",
    readonly database = process.env.NOTION_CODES_QUEUE_DATABASE_ID || "485d1be99ef6402c9a9e264249592e3a",
    private createFetch: typeof fetch = fetch) {}
  async call(route: string, method = "GET", body?: unknown) {
    try { return JSON.parse(await this.request(`https://api.notion.com/v1/${route}`, { method,
      headers: { Authorization: `Bearer ${this.token}`, "Notion-Version": "2026-03-11", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}) }, true)); } catch (error) {
      if (error instanceof FatalDiscoveryError) throw error;
      throw new FatalDiscoveryError(`Notion ${method} ${route.split("/")[0]} request failed`);
    }
  }
  async validate() {
    const schema = await this.call(`data_sources/${this.source}`);
    if ((schema.parent?.database_id || "").replaceAll("-", "") !== this.database.replaceAll("-", "")) throw new FatalDiscoveryError("Codes Queue data source belongs to a different database");
    const expected = { Game: "title", "Universe ID": "number", "Place ID": "number", "Found on": "multi_select", "RobloxDen URL": "url", "Beebom URL": "url", "Roblox URL": "url", Found: "date", Status: "select", "Run report": "rich_text", "Live page": "url", Claimed: "date" };
    for (const [key, type] of Object.entries(expected)) if (schema.properties?.[key]?.type !== type) throw new FatalDiscoveryError(`Codes Queue schema mismatch: ${key} must be ${type}`);
    for (const name of ["RobloxDen", "Beebom"]) if (!schema.properties["Found on"].multi_select.options.some((option: any) => option.name === name)) throw new FatalDiscoveryError(`Missing Codes Queue source ${name}`);
    for (const name of ["New", "Claimed", "Published", "Skipped", "Failed"]) if (!schema.properties.Status.select.options.some((option: any) => option.name === name)) throw new FatalDiscoveryError(`Missing Codes Queue status ${name}`);
  }
  async find(universe: number) {
    const result = await this.call(`data_sources/${this.source}/query`, "POST", { filter: { property: "Universe ID", number: { equals: universe } }, page_size: 2 });
    if (result.results.length > 1) throw new FatalDiscoveryError(`Duplicate Codes Queue Universe ID ${universe}`);
    return result.results[0] ?? null;
  }
  async put(game: { universe_id: number; root_place_id: number; name: string }, source: "RobloxDen" | "Beebom", url: string, dry: boolean) {
    // Never retry an uncertain POST blindly: the caller retries by querying this key.
    const existing = await this.find(game.universe_id);
    const field = source === "RobloxDen" ? "RobloxDen URL" : "Beebom URL";
    const decision = queueDecision(null, existing ? { status: existing.properties.Status.select?.name, urls: [existing.properties[field]?.url].filter(Boolean) } : null, url);
    if (decision === "already-queued" || existing?.properties[field]?.url) return "already-queued";
    if (dry) { console.log(JSON.stringify({ would: existing ? "merge" : "create", game, source, url })); return existing ? "merge" : "create"; }
    const found = new Set<string>((existing?.properties["Found on"]?.multi_select ?? []).map((item: any) => item.name)); found.add(source);
    const properties: Record<string, unknown> = { [field]: { url }, "Found on": { multi_select: [...found].map(name => ({ name })) } };
    if (!existing) Object.assign(properties, { Game: { title: [{ text: { content: game.name.slice(0,2000) } }] }, "Universe ID": { number: game.universe_id }, "Place ID": { number: game.root_place_id }, "Roblox URL": { url: `https://www.roblox.com/games/${game.root_place_id}` }, Found: { date: { start: new Date().toISOString() } }, Status: { select: { name: "New" } } });
    if (existing) await this.call(`pages/${existing.id}`, "PATCH", { properties });
    else {
      // A create timeout can mean Notion accepted the write. Fail this run and
      // query by universe on the next run instead of repeating POST.
      await this.callCreate({ parent: { type: "data_source_id", data_source_id: this.source }, properties });
    }
    return existing ? "merge" : "create";
  }
  private async callCreate(body: unknown) {
    let response: Response;
    try { response = await this.createFetch("https://api.notion.com/v1/pages", { method: "POST", signal: AbortSignal.timeout(20_000), headers: {
      Authorization: `Bearer ${this.token}`, "Notion-Version": "2026-03-11", "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch { throw new FatalDiscoveryError("Notion create response uncertain; rerun to reconcile by Universe ID"); }
    if (!response.ok) throw new FatalDiscoveryError(`Notion create failed (${response.status}); rerun to reconcile by Universe ID`);
    await response.json();
  }
}

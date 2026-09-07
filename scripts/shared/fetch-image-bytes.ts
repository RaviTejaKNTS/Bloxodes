// Retry only transient GET/body failures, never invalid content or definitive HTTP errors.
export async function fetchImageBytes(url: string, init: RequestInit = {}, fetcher = fetch, pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try { response = await fetcher(url, { ...init, signal: AbortSignal.timeout(30_000) }); }
    catch (error) {
      if (attempt >= 2) throw new Error(`Image download failed at ${new URL(url).hostname}: ${error instanceof Error ? error.message : error}`, { cause: error });
      await pause(1000 * 2 ** attempt); continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt < 2) { await pause(1000 * 2 ** attempt); continue; }
      throw new Error(`Image ${url} returned HTTP ${response.status}`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/") && !type.includes("octet-stream")) { await response.body?.cancel(); throw new Error(`Image ${url} returned invalid content type ${type}`); }
    try { return Buffer.from(await response.arrayBuffer()); }
    catch (error) { if (attempt >= 2) throw error; await pause(1000 * 2 ** attempt); }
  }
}

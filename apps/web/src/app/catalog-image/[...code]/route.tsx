import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { decoration } from "@/lib/catalog-image-decoration";
import { catalogCodeCandidates } from "@/lib/catalog-code-candidates";
import { cacheTagsForPath, serializeCacheTags } from "@/lib/public-cache-tags";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { loadCatalogImageData } from "@/lib/catalog-image-data";
import { catalogTitleCount } from "@/lib/catalog-title-count";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function renderCover(_request: Request, { params }: { params: Promise<{ code: string[] }> }) {
  const segments = (await params).code;
  const raw = segments.join("/");
  if (segments.length > 4 || raw.length > 200 || !/^[a-z0-9-]+(?:\/[a-z0-9-]+){0,3}\.png$/.test(raw)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const code = raw.slice(0, -4);
  const page = await getCatalogPageContentByCodes(catalogCodeCandidates(code));
  if (!page) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  // Database failures propagate. Only remote decoration is allowed to fail open.
  const data = await loadCatalogImageData(page);
  const [background, ...images] = await Promise.all([
    data.background ? decoration(data.background) : undefined,
    ...(data.type === "items" ? (data.images ?? []).slice(0, 6).map(decoration) : [])
  ]);
  const title = catalogTitleCount(page.title, data.count);
  const artwork = images.filter((src): src is string => Boolean(src));
  const section = /music/.test(code) ? "Music IDs" : /decal/.test(code) ? "Decal IDs" : /items|bundles/.test(code) ? "Items & bundles" : "Roblox reference";
  // Inter bold averages about 0.56em per character; 0.6em leaves room for wide
  // letters. Three lines at these sizes fit every current catalog title.
  const fontSize = title.length <= 40 ? 64 : title.length <= 75 ? 56 : 48;
  const lines: string[] = [];
  const capacity = Math.floor(1104 / (fontSize * 0.6));
  let remaining = title;
  while (remaining.length > capacity && lines.length < 2) {
    const space = remaining.lastIndexOf(" ", capacity);
    const end = space > capacity / 2 ? space : capacity;
    lines.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  lines.push(remaining.length > capacity ? remaining.slice(0, capacity - 1) + "…" : remaining);
  const fonts = await Promise.all([400, 700].map(async weight => ({
    name: "Inter", data: await readFile(path.join(process.cwd(), `public/fonts/Inter-${weight}.woff`)),
    weight: weight as 400 | 700, style: "normal" as const
  })));
  const brandMark = `data:image/png;base64,${(await readFile(path.join(process.cwd(), "public/favicon-48x48.png"))).toString("base64")}`;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "rgb(237,240,248)", color: background ? "white" : "rgb(32,38,60)", padding: 48, fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
      {background ? <img src={background} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} /> : null}
      {background ? <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, backgroundImage: "linear-gradient(90deg, rgba(5,5,5,0.94), rgba(5,5,5,0.20))" }} /> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, marginBottom: 32 }}>
        <img src={brandMark} alt="" width={42} height={42} style={{ borderRadius: 4 }} />
        Bloxodes
      </div>
      <div style={{ display: "flex", fontSize: 22, color: background ? "rgb(132,169,255)" : "rgb(79,70,229)", marginBottom: 20 }}>Catalog · {section}</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize, lineHeight: 1.12, fontWeight: 700, width: 1104 }}>
        {lines.map((line, index) => <div key={index} style={{ display: "flex" }}>{line}</div>)}
      </div>
      {artwork.length ? <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", width: 1104 }}>
        {artwork.map((src, index) => <div key={index} style={{ display: "flex", width: 172, height: 172, padding: 12, borderRadius: 4, background: "rgb(226,229,243)" }}><img src={src} alt="" width={148} height={148} style={{ objectFit: "contain" }} /></div>)}
      </div> : <div style={{ display: "flex", marginTop: "auto", width: 96, height: 6, background: "rgb(79,70,229)" }} />}
    </div>,
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600", "Cache-Tag": serializeCacheTags(cacheTagsForPath(`/catalog/${code}`)) } }
  );
}

export async function GET(request: Request, context: { params: Promise<{ code: string[] }> }) {
  try {
    // Consume rendering here so a PNG stream failure also gets an uncached 500.
    const response = await renderCover(request, context);
    if (response.status !== 200) return response;
    return new Response(await response.arrayBuffer(), { headers: response.headers });
  } catch (error) {
    console.error("Catalog cover failed", error);
    return new Response("Catalog cover unavailable", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

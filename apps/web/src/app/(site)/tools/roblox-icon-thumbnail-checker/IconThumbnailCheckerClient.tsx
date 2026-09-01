"use client";

import { useEffect, useRef, useState } from "react";

import {
  calculateCenteredCropLoss,
  checkPromotionalImage,
  HOME_PERSONALIZATION_MAX_BYTES_EXCLUSIVE,
  inspectImageHeader,
  LOCAL_INSPECTION_MAX_BYTES,
  LOCAL_INSPECTION_MAX_PIXELS,
  PROMOTIONAL_IMAGE_RULES_VERIFIED_DATE,
  type CheckStatus,
  type DetectedImageFormat,
  type ImageMetadata,
  type ImageTargetResult
} from "@/lib/roblox-platform-tools/icon-thumbnail-checker";

type InspectedFile = ImageMetadata & {
  filename: string;
  objectUrl: string | null;
  extensionMismatch: boolean;
  animatedGif: boolean;
};

const STATUS_COPY: Record<CheckStatus, string> = { pass: "Pass", warn: "Warn", fail: "Fail", unknown: "Unknown" };

function extensionFormat(filename: string): DetectedImageFormat {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  if (extension === "png" || extension === "gif" || extension === "bmp" || extension === "tga" || extension === "webp") return extension;
  return "unknown";
}

function statusClass(status: CheckStatus): string {
  if (status === "pass") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
  if (status === "warn") return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  if (status === "fail") return "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200";
  return "border-border/60 bg-surface text-muted";
}

function ResultCard({ title, result, notes }: { title: string; result: ImageTargetResult; notes: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-5">
      <div className="flex items-start justify-between gap-4"><h3 className="text-lg font-semibold text-foreground">{title}</h3><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(result.status)}`}>{STATUS_COPY[result.status]}</span></div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">Aspect ratio</dt><dd className="text-right font-semibold text-foreground">{STATUS_COPY[result.aspect]}</dd>
        <dt className="text-muted">Resolution</dt><dd className="text-right font-semibold text-foreground">{STATUS_COPY[result.resolution]}</dd>
        <dt className="text-muted">Format</dt><dd className="text-right font-semibold text-foreground">{STATUS_COPY[result.format]}</dd>
        <dt className="text-muted">File size</dt><dd className="text-right font-semibold text-foreground">{STATUS_COPY[result.fileSize]}</dd>
      </dl>
      {result.correction ? <p className="mt-4 text-sm leading-6 text-foreground">{result.correction}</p> : null}
      <p className="mt-3 text-xs leading-5 text-muted">{notes}</p>
    </div>
  );
}

export function IconThumbnailCheckerClient() {
  const [inspected, setInspected] = useState<InspectedFile | null>(null);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState<"stretch" | "crop">("stretch");
  const [showMetadataOverlay, setShowMetadataOverlay] = useState(true);
  const requestId = useRef(0);

  useEffect(() => () => {
    if (inspected?.objectUrl) URL.revokeObjectURL(inspected.objectUrl);
  }, [inspected]);

  async function inspectFile(file: File | undefined) {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setError("");
    setInspected(null);
    if (!file) return;
    if (file.size === 0) { setError("Choose a non-empty image file."); return; }
    if (file.size > LOCAL_INSPECTION_MAX_BYTES) { setError(`This browser safety limit accepts files up to ${(LOCAL_INSPECTION_MAX_BYTES / 1_000_000).toFixed(0)} MB. It is not a Roblox upload limit.`); return; }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (currentRequest !== requestId.current) return;
      const header = inspectImageHeader(bytes, file.name);
      if (header.format === "unknown") { setError("This checker could not identify a supported raster image. SVG and malformed files are not rendered."); return; }

      let width = header.width;
      let height = header.height;
      let objectUrl: string | null = null;
      if (header.format !== "tga") {
        objectUrl = URL.createObjectURL(file);
        if (width === null || height === null) {
          const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error("decode"));
            image.src = objectUrl!;
          });
          width = dimensions.width;
          height = dimensions.height;
        }
      }
      if (!width || !height) { if (objectUrl) URL.revokeObjectURL(objectUrl); setError("The image format was recognized, but trustworthy dimensions could not be read."); return; }
      if (width * height > LOCAL_INSPECTION_MAX_PIXELS) { if (objectUrl) URL.revokeObjectURL(objectUrl); setError(`This browser safety limit accepts up to ${LOCAL_INSPECTION_MAX_PIXELS.toLocaleString("en-US")} decoded pixels. It is not a Roblox upload limit.`); return; }
      const animatedGif = header.format === "gif" && bytes.reduce((count, value) => count + (value === 0x2c ? 1 : 0), 0) > 1;
      setInspected({ filename: file.name, width, height, bytes: file.size, format: header.format, objectUrl, extensionMismatch: extensionFormat(file.name) !== header.format, animatedGif });
    } catch {
      setError("The browser could not decode this image. Try exporting a fresh PNG or JPEG copy.");
    }
  }

  const result = inspected ? checkPromotionalImage(inspected) : null;
  const thumbnailCrop = inspected ? calculateCenteredCropLoss(inspected.width, inspected.height, 16, 9) : null;

  return (
    <div className="tool-surface space-y-8">
      <section className="panel p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-center">
          <div><h2 className="text-xl font-semibold text-foreground">Choose one local image</h2><p className="mt-2 text-sm leading-6 text-muted">Your image stays in this browser. The page does not upload it to Bloxodes, Roblox, an API route, analytics, or storage.</p></div>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-accent/50 bg-accent/5 px-6 py-8 text-center text-sm font-semibold text-accent hover:bg-accent/10"><input type="file" accept=".jpg,.jpeg,.gif,.png,.tga,.bmp,.webp,image/jpeg,image/gif,image/png,image/bmp,image/webp" className="sr-only" onChange={(event) => void inspectFile(event.target.files?.[0])} />Select image file</label>
        </div>
        {error ? <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-200">{error}</div> : null}
      </section>

      {inspected && result ? <>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="panel space-y-4 p-6">
            <h2 className="text-xl font-semibold text-foreground">Local file summary</h2>
            <dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">File</dt><dd className="max-w-[60%] truncate font-semibold text-foreground">{inspected.filename}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Dimensions</dt><dd className="font-semibold text-foreground">{inspected.width.toLocaleString("en-US")} × {inspected.height.toLocaleString("en-US")} px</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Aspect ratio</dt><dd className="font-semibold text-foreground">{result.reducedAspect} ({result.decimalAspect.toFixed(4)})</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Detected format</dt><dd className="font-semibold uppercase text-foreground">{inspected.format}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">File size</dt><dd className="font-semibold text-foreground">{inspected.bytes.toLocaleString("en-US")} bytes ({(inspected.bytes / 1_000_000).toFixed(3)} MB)</dd></div></dl>
            {inspected.extensionMismatch ? <div className={`rounded-lg border p-3 text-sm ${statusClass("warn")}`}>The filename extension does not match the detected content. Results use the detected format.</div> : null}
            {inspected.animatedGif ? <div className={`rounded-lg border p-3 text-sm ${statusClass("warn")}`}>This appears to be animated. The checker reads the canvas size but does not inspect every frame.</div> : null}
            {inspected.format === "tga" ? <p className="text-xs leading-5 text-muted">The TGA header is valid, but this browser cannot provide the visual previews below.</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard title="Experience icon" result={result.icon} notes="Icon formats and byte limits are Unknown because Roblox's current icon page does not publish them." />
            <ResultCard title="Detail-page thumbnail" result={result.detailThumbnail} notes="Roblox publishes 1920 × 1080 as ideal and no universal byte limit on the cited image-thumbnail section." />
            <ResultCard title="Home personalization" result={result.homePersonalization} notes={`The file must be under ${HOME_PERSONALIZATION_MAX_BYTES_EXCLUSIVE.toLocaleString("en-US")} bytes under this conservative decimal interpretation of Roblox's 'under 3 MB' instruction.`} />
          </div>
        </section>

        {inspected.objectUrl ? <section className="panel space-y-6 p-6">
          <div><h2 className="text-xl font-semibold text-foreground">Visual checks</h2><p className="mt-2 text-sm leading-6 text-muted">These previews help you judge readability and crop risk. They do not analyze important content or predict moderation.</p></div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div><h3 className="font-semibold text-foreground">Icon previews</h3><div className="mt-3 flex flex-wrap items-end gap-5"><div className="h-64 w-64 overflow-hidden rounded-lg border border-border bg-black/10"><img src={inspected.objectUrl} alt="Large local icon crop preview" className="h-full w-full object-cover" /></div><div><div className="h-[150px] w-[150px] overflow-hidden rounded-lg border border-border bg-black/10"><img src={inspected.objectUrl} alt="150 pixel local icon crop preview" className="h-full w-full object-cover" /></div><p className="mt-2 text-xs text-muted">True 150 × 150 preview</p></div></div><p className="mt-3 text-xs leading-5 text-muted">A non-square source uses a centered square crop simulation here. Roblox requires a square icon but does not document this as an automatic upload crop.</p></div>
            <div><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-foreground">16:9 thumbnail preview</h3><div className="inline-flex rounded-md border border-border text-xs font-semibold"><button type="button" onClick={() => setPreviewMode("stretch")} className={`rounded-l-md px-3 py-2 ${previewMode === "stretch" ? "bg-accent text-white" : "text-foreground"}`}>Roblox stretch</button><button type="button" onClick={() => setPreviewMode("crop")} className={`rounded-r-md px-3 py-2 ${previewMode === "crop" ? "bg-accent text-white" : "text-foreground"}`}>Centered crop</button></div></div><div className="relative mt-3 aspect-video overflow-hidden rounded-lg border border-border bg-black/10"><img src={inspected.objectUrl} alt={`${previewMode === "stretch" ? "Stretched" : "Centered crop"} local thumbnail preview`} className={`h-full w-full ${previewMode === "stretch" ? "object-fill" : "object-cover"}`} />{showMetadataOverlay ? <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-12 text-xs font-semibold text-white">Metadata may cover content near this edge</div> : null}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><p>{previewMode === "stretch" ? "Full source stretched to the documented 16:9 display shape." : thumbnailCrop?.axis === "none" ? "No centered crop loss." : `${thumbnailCrop?.totalLossPercent.toFixed(1)}% total ${thumbnailCrop?.axis} loss, ${thumbnailCrop?.perSidePercent.toFixed(1)}% per side.`}</p><label className="flex items-center gap-2"><input type="checkbox" checked={showMetadataOverlay} onChange={(event) => setShowMetadataOverlay(event.target.checked)} />Show metadata-risk overlay</label></div></div>
          </div>
        </section> : null}

        <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">A pass means the file meets the documented measurable checks for that target. It does not guarantee upload acceptance, moderation approval, originality, truthful content, or discovery performance.</div>
      </> : null}

      <div className="rounded-lg border border-border/60 bg-surface p-4 text-sm leading-6 text-muted">Rules checked {PROMOTIONAL_IMAGE_RULES_VERIFIED_DATE}. Badge icons, passes, developer products, group icons, Marketplace assets, videos, and API-generated thumbnails use separate rules and are outside this checker.</div>
      <div className="flex flex-wrap gap-4"><a href="https://create.roblox.com/docs/en-us/production/publishing/experience-icons" target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">Roblox icon guidance</a><a href="https://create.roblox.com/docs/production/publishing/thumbnails" target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">Roblox thumbnail guidance</a></div>
    </div>
  );
}

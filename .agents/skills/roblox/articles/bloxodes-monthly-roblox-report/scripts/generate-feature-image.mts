import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

type FeatureImageConfig = {
  month: string;
  reportLabel: string;
  headlineLines: string[];
  metric: string;
  chartSeriesPath: string;
  chartValueKey: string;
  accent: string;
};

type Args = {
  modulePath: string;
  exportName?: string;
  outputPath: string;
};

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value) throw new Error(`Invalid argument near ${flag ?? "end of command"}`);
    values.set(flag.slice(2), value);
  }

  const modulePath = values.get("module");
  const outputPath = values.get("output");
  if (!modulePath || !outputPath) {
    throw new Error(
      "Usage: npx tsx generate-feature-image.mts --module <report-data.ts> [--export <name>] --output <image.png>"
    );
  }

  return { modulePath, exportName: values.get("export"), outputPath };
}

function xml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getPath(source: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || !(key in current)) {
      throw new Error(`Feature-image chart path does not exist: ${dottedPath}`);
    }
    return (current as Record<string, unknown>)[key];
  }, source);
}

function resolveReport(moduleExports: Record<string, unknown>, exportName?: string): Record<string, unknown> {
  if (exportName) {
    const selected = moduleExports[exportName];
    if (!selected || typeof selected !== "object") throw new Error(`Report export not found: ${exportName}`);
    return selected as Record<string, unknown>;
  }

  const selected = Object.values(moduleExports).find(
    (value) => value && typeof value === "object" && "featureImage" in value
  );
  if (!selected) throw new Error("Could not find an exported report object with featureImage configuration");
  return selected as Record<string, unknown>;
}

function createChartGeometry(values: number[]) {
  const left = 775;
  const top = 225;
  const width = 355;
  const height = 250;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x = left + (index / Math.max(values.length - 1, 1)) * width;
      const y = top + height - ((value - min) / range) * height;
      return { x, y };
    })
  return {
    path: points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "),
    end: points.at(-1)!
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modulePath = path.resolve(args.modulePath);
  const outputPath = path.resolve(args.outputPath);
  const moduleExports = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  const report = resolveReport(moduleExports, args.exportName);
  const feature = report.featureImage as FeatureImageConfig | undefined;
  if (!feature) throw new Error("Report is missing featureImage configuration");
  if (feature.headlineLines.length < 1 || feature.headlineLines.length > 3) {
    throw new Error("featureImage.headlineLines must contain one to three lines");
  }
  if (feature.headlineLines.some((line) => line.length > 30)) {
    throw new Error("Each featureImage headline line must contain no more than 30 characters");
  }

  const rawPoints = getPath(report, feature.chartSeriesPath);
  if (!Array.isArray(rawPoints)) throw new Error("Feature-image chart source must be an array");
  const values = rawPoints
    .map((point) => (point && typeof point === "object" ? Number((point as Record<string, unknown>)[feature.chartValueKey]) : NaN))
    .filter(Number.isFinite);
  if (values.length < 2) throw new Error("Feature-image chart needs at least two numeric values");

  const logoPath = path.resolve("apps/web/public/Bloxodes-dark.png");
  const logo = await fs.readFile(logoPath);
  const logoData = `data:image/png;base64,${logo.toString("base64")}`;
  const chart = createChartGeometry(values);
  const headline = feature.headlineLines
    .map((line, index) => `<text x="68" y="${226 + index * 72}" class="headline">${xml(line)}</text>`)
    .join("");
  const metricY = 438 + Math.max(0, feature.headlineLines.length - 2) * 44;

  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <style>
        .report-label { font: 600 21px Inter, Arial, Helvetica, sans-serif; letter-spacing: -0.2px; fill: ${xml(feature.accent)}; }
        .headline { font: 700 62px Inter, Arial, Helvetica, sans-serif; letter-spacing: -2.4px; fill: #eef1f7; }
        .metric { font: 600 27px Inter, Arial, Helvetica, sans-serif; letter-spacing: -0.5px; fill: ${xml(feature.accent)}; }
      </style>
      <rect width="1200" height="630" fill="#050608"/>
      <image href="${logoData}" x="952" y="62" width="180" height="61" preserveAspectRatio="xMidYMid meet"/>
      <text x="68" y="145" class="report-label">${xml(feature.reportLabel)}</text>
      ${headline}
      <text x="68" y="${metricY}" class="metric">${xml(feature.metric)}</text>
      <path d="${chart.path}" fill="none" stroke="${xml(feature.accent)}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${chart.end.x.toFixed(1)}" cy="${chart.end.y.toFixed(1)}" r="10" fill="#0c0e12" stroke="${xml(feature.accent)}" stroke-width="5"/>
    </svg>`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630 || metadata.format !== "png") {
    throw new Error(`Unexpected output: ${metadata.width}x${metadata.height} ${metadata.format}`);
  }

  process.stdout.write(`${outputPath}\n${metadata.width}x${metadata.height} ${metadata.format}\n`);
}

await main();

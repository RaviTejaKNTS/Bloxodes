type Point = { players: number | null };

/**
 * Server-rendered SVG area sparkline of platform CCU. No client JS so it's in the
 * initial HTML (SEO + instant paint); colors use the accent token for theming.
 */
export function PlatformCcuChart({ points, className }: { points: Point[]; className?: string }) {
  const values = points.map((p) => (typeof p.players === "number" ? p.players : 0));
  if (values.length < 2) return null;

  const width = 600;
  const height = 120;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const coords = values.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Platform concurrent players over the last 24 hours"
    >
      <path d={area} style={{ fill: "rgb(var(--color-accent) / 0.16)" }} />
      <path
        d={line}
        fill="none"
        style={{ stroke: "rgb(var(--color-accent))" }}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

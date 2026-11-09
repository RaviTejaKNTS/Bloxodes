/** Display precision shared by charts, writer notes and the prose checker. */
export function compact(value: number): string {
  const size = Math.abs(value);
  const [scale, suffix, digits] = size >= 1e9 ? [1e9, 'B', 2] as const
    : size >= 1e6 ? [1e6, 'M', 2] as const
      : size >= 1e3 ? [1e3, 'K', 0] as const : [1, '', 0] as const;
  return `${Number((value / scale).toFixed(digits))}${suffix}`;
}
export const decimal = (value: number) => value.toFixed(1);
export const signed = (value: number) => `${value > 0 ? '+' : ''}${decimal(value)}`;
export function shortDate(value: string): string {
  return new Date(value.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

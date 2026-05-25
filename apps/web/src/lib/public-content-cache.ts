import "server-only";

type CacheOptions = {
  revalidate?: number | false;
  tags?: string[];
};

type AsyncFn = (...args: any[]) => Promise<any>;

export function publicContentCache<T extends AsyncFn>(
  loader: T,
  _keyParts: string[],
  _options?: CacheOptions
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => loader(...args)) as T;
}

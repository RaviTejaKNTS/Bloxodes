import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("react");
  vi.resetModules();
});

it.each([{}, { cache: undefined }, { cache: null }])("runs readers when React cache is unavailable: %j", async react => {
  vi.resetModules();
  vi.doMock("react", () => react);
  const { requestCache } = await import("../request-cache");
  const reader = vi.fn(async (id: number) => ({ id }));
  const cached = requestCache(reader);
  expect(cached).toBe(reader);
  await expect(cached(42)).resolves.toEqual({ id: 42 });
  expect(reader).toHaveBeenCalledWith(42);
  const failure = new Error("reader failed");
  await expect(requestCache(async () => { throw failure; })()).rejects.toBe(failure);
});

it("uses React cache when the server export or an existing mock provides it", async () => {
  vi.resetModules();
  const wrapped = vi.fn();
  const cache = vi.fn(() => wrapped);
  vi.doMock("react", () => ({ cache }));
  const { requestCache } = await import("../request-cache");
  const reader = async (id: number) => id;
  expect(requestCache).toBe(cache);
  expect(requestCache(reader)).toBe(wrapped);
  expect(cache).toHaveBeenCalledWith(reader);
});

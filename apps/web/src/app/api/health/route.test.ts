import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: mocks.from,
    rpc: mocks.rpc
  })
}));

import { GET } from "./route";

function databaseQuery(error: { message: string } | null = null) {
  return {
    select: vi.fn(() => ({
      limit: vi.fn(async () => ({ error }))
    }))
  };
}

describe("deployment health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks only basic database readiness for deploy scope", async () => {
    mocks.from.mockReturnValue(databaseQuery());

    const response = await GET(new Request("https://bloxodes.com/api/health?scope=deploy"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      status: "healthy",
      scope: "deploy",
      checks: { database: { ok: true, error: null } }
    });
    expect(Object.keys(payload.checks)).toEqual(["database"]);
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("code_pages");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails deploy readiness when the basic database check fails", async () => {
    mocks.from.mockReturnValue(databaseQuery({ message: "database unavailable" }));

    const response = await GET(new Request("https://bloxodes.com/api/health?scope=deploy"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      status: "unhealthy",
      checks: { database: { ok: false, error: "database unavailable" } }
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

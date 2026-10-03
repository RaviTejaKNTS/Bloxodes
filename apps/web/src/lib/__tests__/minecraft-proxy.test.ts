import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("Minecraft server-side edition preference", () => {
  it("remembers an explicit edition on the server without sharing personalized HTML", () => {
    const response = proxy(new NextRequest("https://bloxodes.com/minecraft/wiki?edition=bedrock"));
    expect(response.cookies.get("minecraft-edition")?.value).toBe("bedrock");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
    const remembered = proxy(new NextRequest("https://bloxodes.com/minecraft/wiki", { headers: { cookie: "minecraft-edition=bedrock" } }));
    expect(remembered.headers.get("location")).toBe("https://bloxodes.com/minecraft/wiki?edition=bedrock");
  });
  it("honors explicit Java links even with a Bedrock cookie and stays within Minecraft", () => {
    const headers = { cookie: "minecraft-edition=bedrock" };
    const response = proxy(new NextRequest("https://bloxodes.com/minecraft/wiki/recipes?edition=java", { headers }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("minecraft-edition")?.value).toBe("java");
    expect(proxy(new NextRequest("https://bloxodes.com/wiki?edition=java", { headers })).cookies.get("minecraft-edition")).toBeUndefined();
  });
});

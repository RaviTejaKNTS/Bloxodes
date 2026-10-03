import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MinecraftEditionSelector } from "../MinecraftEditionSelector";

describe("server-rendered Minecraft edition navigation", () => {
  it("exposes both editions as ordinary links without browser state or JavaScript", () => {
    const html = renderToStaticMarkup(createElement(MinecraftEditionSelector, { edition: "bedrock", basePath: "/minecraft/wiki", label: "Show collections for your edition" }));
    expect(html).toContain('aria-label="Minecraft edition"');
    expect(html).toContain('href="/minecraft/wiki?edition=java"');
    expect(html).toContain('href="/minecraft/wiki?edition=bedrock" aria-current="page"');
    expect(html).toContain("Java Edition");
    expect(html).toContain("Bedrock Edition");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<select");
  });
});

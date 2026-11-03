import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: () => { throw new Error("Shell must stay static"); } }));
vi.mock("next/font/google", () => ({ Inter: () => ({ className: "font" }) }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/RecentVisitTracker", () => ({ RecentVisitTracker: () => null }));
import { SiteShell } from "../SiteShell";
it("renders page content without request headers or game reads", () => {
 expect(renderToStaticMarkup(SiteShell({ children: "Roblox page" }))).toContain("Roblox page");
 const source = readFileSync(new URL("../SiteShell.tsx", import.meta.url), "utf8");
 expect(source).not.toMatch(/next\/headers|headers\(|readGameIndexPaths|getGameMenu|gamePaths|gameMenus/);
});
it("keeps the full home and game listings on hourly ISR", () => {
 for (const file of ["../../app/(site)/page.tsx", "../../app/(site)/games/page.tsx", "../../app/(site)/layout.tsx"]) {
  expect(readFileSync(new URL(file, import.meta.url), "utf8")).toContain("export const revalidate = 3600");
 }
});

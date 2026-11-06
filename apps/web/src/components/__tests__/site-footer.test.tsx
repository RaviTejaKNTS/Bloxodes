// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tools" }));
vi.mock("next/image", () => ({ default: (props: ComponentProps<"img">) => <img alt={props.alt} /> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a> }));

import { SiteFooter } from "@/components/SiteFooter";

it("server-renders feedback beside company links at their text size on every screen", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<SiteFooter />);
  const trigger = container.querySelector('footer button[aria-label="Give feedback to improve Bloxodes"]')!;
  expect(trigger.textContent).toBe("Give feedback");
  expect(trigger.closest("ul")?.querySelector('a[href="/contact"]')).not.toBeNull();
  expect(trigger.className).toContain("text-sm");
  expect(trigger.className).toContain("font-medium");
  expect(trigger.querySelector("span")?.className).not.toContain("hidden");
  expect(trigger.querySelector("svg")).toBeNull();
});

it("opens its own feedback dialog from the footer without a More drawer", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    flushSync(() => root.render(<SiteFooter />));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Give feedback to improve Bloxodes"]')!;
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Improve Bloxodes"));
    expect(document.querySelector('[role="dialog"] textarea[required]')).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#site-more-drawer")).toBeNull();
  } finally {
    flushSync(() => root.unmount());
    container.remove();
  }
});

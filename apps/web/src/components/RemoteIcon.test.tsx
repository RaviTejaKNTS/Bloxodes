// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { RemoteIcon } from "./RemoteIcon";

let container: HTMLDivElement;
let root: Root | undefined;
const props = { src: "https://cdn.test/expired", alt: "Pass icon", size: 40, fallback: <span>fallback</span> };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
});

it("replaces a server image that failed before hydration and tries a changed URL", async () => {
  container.innerHTML = renderToString(<RemoteIcon {...props} />);
  const image = container.querySelector("img")!;
  // jsdom does not load remote images. Model the browser's completed failed
  // request on the actual server DOM node, before React attaches its listeners.
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 0 } });
  image.dispatchEvent(new Event("error"));
  expect(container.querySelector("img")).toBe(image);
  await act(async () => { root = hydrateRoot(container, <RemoteIcon {...props} />); });
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("fallback");

  await act(async () => { root!.render(<RemoteIcon {...props} src="https://cdn.test/current" />); });
  expect(container.querySelector("img")?.src).toBe("https://cdn.test/current");
});

it("handles a normal post-hydration error with real React state", async () => {
  container.innerHTML = renderToString(<RemoteIcon {...props} />);
  await act(async () => { root = hydrateRoot(container, <RemoteIcon {...props} />); });
  expect(container.querySelector("img")).not.toBeNull();
  await act(async () => { container.querySelector("img")!.dispatchEvent(new Event("error")); });
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("fallback");
});

it("keeps a successfully loaded server image and handles a missing URL", async () => {
  container.innerHTML = renderToString(<RemoteIcon {...props} />);
  const image = container.querySelector("img")!;
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 150 } });
  await act(async () => { root = hydrateRoot(container, <RemoteIcon {...props} />); });
  expect(container.querySelector("img")).toBe(image);
  await act(async () => { root!.render(<RemoteIcon {...props} src={null} />); });
  expect(container.textContent).toBe("fallback");
});

it("renders a missing-image fallback on initial client mount", async () => {
  await act(async () => {
    root = createRoot(container);
    root.render(<RemoteIcon {...props} src={null} />);
  });
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("fallback");
});

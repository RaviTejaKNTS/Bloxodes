// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CollectionVideo } from "../CollectionVideo";
import { GameCollectionView, type GameCollectionViewConfig } from "../GameCollectionView";

vi.mock("../CollectionImageLightbox", () => ({ CollectionImageLightbox: () => null }));
// CI loads React's production build, which has no `act`; flush updates directly instead.
async function settle(run: () => void) {
  flushSync(run);
  await new Promise((resolve) => setTimeout(resolve, 0));
}
const url = "https://www.youtube.com/watch?v=QdBZY2fkU-0";
const poster = "https://media.bloxodes.com/trailer.webp";
const config: GameCollectionViewConfig = {
  slug: "example-videos", label: "Videos", groupLabel: "Videos",
  cardFields: ["videoUrl"], stats: [{ key: "videoUrl", label: "Video" }],
  fieldPresentation: { videoUrl: { kind: "video" } },
};

function renderItem(videoUrl: string | null, options = config, image: string | null = poster) {
  return renderToStaticMarkup(<GameCollectionView config={options} sections={[{
    id: "videos", label: "Videos", items: [{ id: "trailer", name: "Trailer", image, videoUrl }],
  }]} />);
}

describe("collection video facade", () => {
  it("server-renders a named button and hosted poster without an iframe", () => {
    const html = renderToStaticMarkup(<CollectionVideo url={url} title="Trailer" poster={poster} />);
    expect(html).toContain('aria-label="Play Trailer"');
    expect(html).toContain('type="button"');
    expect(html).toContain(poster);
    expect(html).toContain("aspect-video");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("i.ytimg.com");
  });

  it("uses a YouTube poster when the item has no image", () => {
    expect(renderItem(url, { ...config, hideImages: true, hideMissingImagePlaceholders: true }, null))
      .toContain("https://i.ytimg.com/vi/QdBZY2fkU-0/hqdefault.jpg");
  });

  it("replaces only a declared, valid card video's image", () => {
    expect(renderItem(url)).toContain("data-collection-video");
    expect(renderItem(url)).not.toContain("data-collection-image-preview");
    for (const html of [renderItem(null), renderItem("https://evil.test/watch?v=QdBZY2fkU-0"),
      renderItem(url, { ...config, fieldPresentation: undefined })]) {
      expect(html).toContain("data-collection-image-preview");
      expect(html).not.toContain("data-collection-video");
    }
  });

  it("renders validated table and detail links without loading players", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await settle(() => root.render(<GameCollectionView config={config} sections={[{
        id: "videos", label: "Videos", items: [
          { id: "valid", name: "Valid", image: poster, videoUrl: url },
          { id: "invalid", name: "Invalid", image: poster, videoUrl: "https://evil.test/watch?v=QdBZY2fkU-0" },
        ],
      }]} />));
      const listButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "List")!;
      await settle(() => listButton.click());
      const link = container.querySelector("table a")!;
      expect(link.getAttribute("href")).toBe(url);
      expect(link.textContent).toBe("Watch on YouTube");
      expect(container.querySelectorAll("table a")).toHaveLength(1);
      expect(container.querySelector("iframe")).toBeNull();
      expect(container.textContent).not.toContain("evil.test");
    } finally {
      root.unmount();
      container.remove();
    }
    const html = renderItem(url, { ...config, cardFields: [], detailFields: ["videoUrl"] });
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain("data-collection-video");
  });

  it("loads only the clicked video's privacy-enhanced player and moves focus to it", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await settle(() => root.render(<>
        <CollectionVideo url={url} title="Trailer 1" poster={poster} />
        <CollectionVideo url="https://youtu.be/VQRLujxTm3c" title="Trailer 2" poster={null} />
      </>));
      expect(container.querySelectorAll("iframe")).toHaveLength(0);
      const button = container.querySelector("button")!;
      button.focus();
      expect(document.activeElement).toBe(button);
      await settle(() => button.click());
      const frame = container.querySelector("iframe")!;
      expect(container.querySelectorAll("iframe")).toHaveLength(1);
      expect(frame.src).toBe("https://www.youtube-nocookie.com/embed/QdBZY2fkU-0?autoplay=1");
      expect(frame.title).toBe("Trailer 1");
      expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
      expect(frame.hasAttribute("allowfullscreen")).toBe(true);
      expect(document.activeElement).toBe(frame);
      expect(container.querySelector('button[aria-label="Play Trailer 2"]')).not.toBeNull();
    } finally {
      root.unmount();
      container.remove();
    }
  });
});

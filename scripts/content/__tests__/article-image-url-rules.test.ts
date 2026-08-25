import assert from "node:assert/strict";
import test from "node:test";

import { verifyArticleImageUrls, type ArticleImageFetch } from "../verify-article-image-urls";

test("resolves root-relative image URLs and checks each unique response once", async () => {
  const requested: string[] = [];
  const fetcher: ArticleImageFetch = async (url) => {
    requested.push(url);
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/webp" },
    });
  };

  const urls = await verifyArticleImageUrls({
    articleUrl: "http://127.0.0.1:3000/articles/example",
    imageSources: ["/images/tower.webp", "/images/tower.webp"],
    fetcher,
  });

  assert.deepEqual(urls, ["http://127.0.0.1:3000/images/tower.webp"]);
  assert.deepEqual(requested, urls);
});

test("rejects a broken rendered image response", async () => {
  await assert.rejects(
    verifyArticleImageUrls({
      articleUrl: "http://127.0.0.1:3000/articles/example",
      imageSources: ["/missing.webp"],
      fetcher: async () => new Response("missing", { status: 404 }),
    }),
    /returned HTTP 404/,
  );
});

test("rejects a non-image response", async () => {
  await assert.rejects(
    verifyArticleImageUrls({
      articleUrl: "http://127.0.0.1:3000/articles/example",
      imageSources: ["/not-an-image.webp"],
      fetcher: async () => new Response("page", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    }),
    /not an image/,
  );
});

test("rejects an empty image response", async () => {
  await assert.rejects(
    verifyArticleImageUrls({
      articleUrl: "http://127.0.0.1:3000/articles/example",
      imageSources: ["/empty.webp"],
      fetcher: async () => new Response(null, {
        status: 200,
        headers: { "content-type": "image/webp" },
      }),
    }),
    /empty image response/,
  );
});

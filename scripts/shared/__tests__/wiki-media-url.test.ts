import assert from "node:assert/strict";
import test from "node:test";
import * as plain from "../wiki-media-url.mjs";
import * as web from "../../../apps/web/src/lib/wiki-media";

test("plain-Node wiki media hosts match the web helper", () => {
  assert.equal(plain.WIKI_MEDIA_BASE_URL, web.WIKI_MEDIA_BASE_URL);
  assert.equal(plain.WIKI_MEDIA_HOSTNAME, web.WIKI_MEDIA_HOSTNAME);
  assert.equal(plain.LEGACY_WIKI_MEDIA_BASE_URL, web.LEGACY_WIKI_MEDIA_BASE_URL);
  assert.equal(new URL(web.WIKI_MEDIA_BASE_URL).hostname, web.WIKI_MEDIA_HOSTNAME);
  for (const value of ["https://media.bloxodes.com/wiki/1/a.webp", "https://wiki-media.bloxodes.com/1/a.webp", "https://media.bloxodes.com/wiki-cover.webp", "https://media.bloxodes.com/storage/v1/object/public/a.png"]) {
    assert.equal(plain.rewriteLegacyWikiMediaUrl(value), web.rewriteLegacyWikiMediaUrls(value), value);
  }
  assert.equal(plain.rewriteLegacyWikiMediaUrl(null), null);
});

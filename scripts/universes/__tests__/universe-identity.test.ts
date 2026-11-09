import assert from "node:assert/strict";
import test from "node:test";
import { statsUniverseSlug } from "@/lib/slug";
import { hasPlaceholderUniverseIdentity, isPlaceholderGameDetail, repairedUniverseIdentity } from "../universe-identity";

test("each Roblox placeholder signal rejects identity, including when the ID is real", () => {
  const valid = { id: 9867225552, name: "[D4C] A Bizarre Run", rootPlaceId: 123 };
  assert.equal(isPlaceholderGameDetail(valid), false);
  for (const detail of [
    { ...valid, id: 0 },
    { ...valid, name: "[TITLE UNAVAILABLE]" },
    { ...valid, rootPlaceId: 0 },
    { id: 0, name: "[TITLE UNAVAILABLE]", rootPlaceId: 0 }
  ]) {
    assert.equal(isPlaceholderGameDetail(detail), true);
    assert.equal(repairedUniverseIdentity(detail, valid.id), null);
  }
  assert.equal(repairedUniverseIdentity({ ...valid, id: 456 }, valid.id), null);
  assert.equal(repairedUniverseIdentity({ ...valid, name: " " }, valid.id), null);
  assert.equal(repairedUniverseIdentity({ ...valid, rootPlaceId: undefined }, valid.id), null);
});

test("stored placeholder names or slugs are repairable, but ordinary names stay locked", () => {
  assert.equal(hasPlaceholderUniverseIdentity({ name: "[TITLE UNAVAILABLE]", slug: "older-name" }), true);
  assert.equal(hasPlaceholderUniverseIdentity({ name: "Real name", slug: "title-unavailable" }), true);
  assert.equal(hasPlaceholderUniverseIdentity({ name: "Real name", slug: "real-name" }), false);
  const identity = repairedUniverseIdentity({ id: 123, name: "[D4C] A Bizarre Run", rootPlaceId: 456 }, 123);
  assert.deepEqual(identity, { root_place_id: 456, name: "[D4C] A Bizarre Run", display_name: "A Bizarre Run", slug: "a-bizarre-run" });
  // Both old and new URLs retain the same ID for the existing canonical redirect.
  assert.equal(statsUniverseSlug("title-unavailable", 123), "title-unavailable-123");
  assert.equal(statsUniverseSlug(identity!.slug, 123), "a-bizarre-run-123");
});

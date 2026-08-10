import assert from "node:assert/strict";
import test from "node:test";

import { sameSearchIntent } from "../article-curation-intent";

test("does not merge separate player tasks just because they share a game name", () => {
  assert.equal(
    sameSearchIntent("100 Days at Sea Crafting Items Guide", "100 Days at Sea Farming Guide"),
    false
  );
  assert.equal(
    sameSearchIntent("How to Increase Day Count Multiplier in 100 Days at Sea", "100 Days at Sea Farming Guide"),
    false
  );
  assert.equal(
    sameSearchIntent("Escape Tsunami for Brainrots Farming Guide", "Escape Tsunami for Brainrots Crafting Guide"),
    false
  );
  assert.equal(
    sameSearchIntent("How to Get the Deep Rod in Fisch", "Fisch Remembrance Rod Mastery Guide"),
    false
  );
});

test("recognizes interchangeable coverage of the same named mechanic or item", () => {
  assert.equal(
    sameSearchIntent("How to Get Trident Striker Rod in Fisch", "Fisch Trident Striker Ritual Guide"),
    true
  );
  assert.equal(
    sameSearchIntent("Fisch Outer Deep Bestiary Guide", "How to Complete the Outer Deep Bestiary in Fisch"),
    true
  );
});

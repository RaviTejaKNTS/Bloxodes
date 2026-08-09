import assert from "node:assert/strict";
import test from "node:test";

import {
  eligibleArticleAuthorIds,
  pickEligibleArticleAuthorId
} from "../../shared/article-author-selection";

const authors = [
  { id: "ravi", name: "Ravi Teja KNTS", slug: "ravi-teja-knts" },
  { id: "pragna", name: "Pragna Sanisetty", slug: "pragna-sanisetty" },
  { id: "shubham", name: "Shubham Raj\n", slug: "subham-raj" },
  { id: "venkatesh", name: "Venkatesh Bobbili\n", slug: "venkatesh-bobbili" }
];

test("excludes Ravi Teja KNTS while retaining every other author", () => {
  assert.deepEqual(eligibleArticleAuthorIds(authors), ["pragna", "shubham", "venkatesh"]);
});

test("uses a valid preferred author but ignores an excluded preferred author", () => {
  assert.equal(pickEligibleArticleAuthorId(authors, { preferredAuthorId: "shubham" }), "shubham");
  assert.equal(
    pickEligibleArticleAuthorId(authors, { preferredAuthorId: "ravi", random: () => 0 }),
    "pragna"
  );
});

test("does not exclude a managed-dev editorial row merely because its id matches production Ravi", () => {
  assert.deepEqual(
    eligibleArticleAuthorIds([
      { id: "4fc99a58-83da-46f6-9621-7816e36b4088", name: "Bloxodes Editorial", slug: "bloxodes-editorial" }
    ]),
    ["4fc99a58-83da-46f6-9621-7816e36b4088"]
  );
});

test("fails closed when no eligible author remains", () => {
  assert.throws(
    () => pickEligibleArticleAuthorId([{ id: "ravi", name: " Ravi   Teja KNTS ", slug: null }]),
    /No eligible article authors/
  );
});

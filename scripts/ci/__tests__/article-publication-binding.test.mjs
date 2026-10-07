import assert from "node:assert/strict";
import test from "node:test";
import { assertArticleSelection } from "../article-publication-binding.mjs";

const row = {id: "queue-a",result_path: "tmp/article-pipeline/a/content/final.json",result_slug: "article-a"};
const operation = {queueId: row.id,file: row.result_path};
const selected = {realPath: "/frozen/a/final.json",hash: "approved-bytes",slug: row.result_slug};
const batch = {urls: [{path: "/articles/article-a"}],events: [{type: "article",slug: "article-a"}]};
test("an article's selected file must match its queue approval before writes", () => {
  assert.doesNotThrow(() => assertArticleSelection(row,operation,selected,selected,batch));
  for (const wrong of [
    {...selected,realPath: "/frozen/b/final.json"},
    {...selected,hash: "edited-bytes"},
    {...selected,slug: "article-b"}
  ]) assert.throws(() => assertArticleSelection(row,operation,wrong,selected,batch),/approved final/);
  assert.throws(() => assertArticleSelection(row,{...operation,file: "tmp/article-pipeline/b/content/final.json"},selected,selected,batch),/approved final/);
  assert.throws(() => assertArticleSelection(row,{...operation,queueId: "queue-b"},selected,selected,batch),/approved final/);
});
test("another verified article URL cannot acknowledge this queue row", () => {
  assert.throws(() => assertArticleSelection(row,operation,selected,selected,{...batch,urls: [{path: "/articles/article-b"}]}),/canonical URL/);
  assert.throws(() => assertArticleSelection(row,operation,selected,selected,{...batch,events: [{type: "article",slug: "article-b"}]}),/cache event/);
});

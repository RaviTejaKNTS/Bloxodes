export function assertArticleSelection(row, operation, selected, approved, batch) {
  if (operation.queueId !== row.id || operation.file !== row.result_path ||
      selected.realPath !== approved.realPath || selected.hash !== approved.hash ||
      selected.slug !== row.result_slug || selected.slug !== approved.slug) throw new Error("Article queue ID does not match its selected approved final.");
  const page = `/articles/${row.result_slug}`;
  if (!batch.urls.some(url => url.path === page) || !batch.events.some(event => event.type === "article" && event.slug === row.result_slug)) throw new Error("Article release requires its exact canonical URL and cache event before publication.");
}

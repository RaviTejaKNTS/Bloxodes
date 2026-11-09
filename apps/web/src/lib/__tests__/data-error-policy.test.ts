import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

const src = join(dirname(fileURLToPath(import.meta.url)), "../..");
// Only these named helpers may turn a failed read into missing optional content.
// Adding another failure branch in another helper still fails this guard.
const tolerant: Record<string, string> = {
  "lib/wiki.ts:safeList": "Optional related content does not decide page existence.",
  "lib/wiki.ts:safeValue": "Optional wiki sidebar value.",
  "lib/stats.ts:getUniverseStatsSummary": "Optional sidebar summary; detail readers are separate.",
  "lib/stats.ts:loadSimilarStatsItems": "Optional related items below the main item.",
  "lib/stats.ts:loadLatestRank": "Optional current rank; never decides existence.",
  "lib/shared-game-reader.ts:listPublishedSharedGameWikiCollectionImageUrls": "Optional image previews on collection links.",
  "lib/site-route-page.ts:getLiveSiteRoute": "Undefined triggers required exact-path readers, not a 404.",
  "lib/game-top-nav.ts:resolveRouteTarget": "Optional game navigation target; main page uses separate readers.",
  "lib/game-top-nav.ts:getGameTopNavContext": "Optional game navigation identity.",
  "lib/game-site-data.ts:getGameMenuForPath": "Optional second navigation bar.",
  "lib/mobile-content.ts:readJsonFile": "Optional mobile dataset enrichment.",
  "lib/events-summary.ts:getUniverseEventSummary": "Optional sidebar event summary.",
  "lib/catalog-card-meta.ts:resolveCount": "Optional catalog card count.",
  "lib/game-collection-registry.ts:listGameCollectionGroups": "Optional collection navigation; main runtime reads separately.",
  "lib/comments.ts:fetchApprovedComments": "Optional reader comments below the main page.",
  "lib/roblox/universe.ts:safeScrapeMetadata": "Optional external metadata enrichment for an existing game.",
  "app/(site)/catalog/roblox-promo-codes/page-data.tsx:loadFreeItemsPreview": "Optional free-item preview below promo rewards.",
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.name === "__tests__") return [];
    return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path) ? [path] : [];
  });
}
function owner(node: ts.Node): string {
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      // Ignore unnamed callback locals and retain the enclosing public helper.
      if (parent.initializer && (ts.isCallExpression(parent.initializer) || ts.isArrowFunction(parent.initializer))) return parent.name.text;
    }
  }
  return "<module>";
}
function contains(node: ts.Node, predicate: (node: ts.Node) => boolean): boolean {
  if (predicate(node)) return true;
  // A nested callback's return/throw does not handle this branch's failure.
  return node.getChildren().some(child => !ts.isFunctionLike(child) && contains(child, predicate));
}
function emptyReturn(node: ts.Node): boolean {
  if (!ts.isReturnStatement(node) || !node.expression) return false;
  const value = node.expression;
  return value.kind === ts.SyntaxKind.NullKeyword
    || ts.isIdentifier(value) && value.text === "undefined"
    || ts.isArrayLiteralExpression(value) && value.elements.length === 0;
}

it("does not swallow data failures in public server readers", () => {
  const violations: string[] = [];
  for (const path of [...files(join(src, "lib")), ...files(join(src, "app"))]) {
    const text = readFileSync(path, "utf8");
    const name = relative(src, path).replaceAll("\\", "/");
    // Private HTTP handlers return their own status codes. Client state cannot enter ISR.
    if (name.startsWith("app/api/") || name.startsWith("app/auth/") || name.startsWith("lib/auth/") || /^['"]use client['"]/m.test(text)) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node: ts.Node) {
      let branch: ts.Node | undefined;
      if (ts.isIfStatement(node) && /^(?:\w*[Ee]rror|\w+\.error)(?:\s*\|\|.*)?$/.test(node.expression.getText(source))) branch = node.thenStatement;
      if (ts.isCatchClause(node) && ts.isTryStatement(node.parent) && /await[\s\S]*?(?:\.from\(|\.rpc\(|\w+\()/.test(node.parent.tryBlock.getText(source))) branch = node.block;
      if (branch && contains(branch, emptyReturn) && !contains(branch, ts.isThrowStatement) && !tolerant[`${name}:${owner(node)}`]) {
        violations.push(`${name}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} (${owner(node)})`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(violations, "Throw data errors or document a named optional helper in the allowlist").toEqual([]);
});

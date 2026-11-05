export type GameMenuPage = { kind: string; gameId: string; title: string; href: string };
export type GameMenu = { namespace: string; title: string; href: string; image: string; pages: GameMenuPage[] };

export function gameMenuForPath(path: string, menus: GameMenu[]) {
  return menus.find(menu => path === menu.href || menu.pages.some(page => path === page.href || ((page.kind === "wiki" || page.kind === "collection" || page.kind === "article") && path.startsWith(`${page.href}/`))));
}
export function gameSidebarLinks(menu: GameMenu, gameId?: string) {
  return menu.pages.filter(page => !gameId || page.gameId === gameId).map(page => ({ href: page.href, title: page.title }));
}

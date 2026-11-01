import Link from "next/link";
import { listMovedGamePages } from "@/lib/moved-game-pages";
export async function OtherGamesSection({ kind }: { kind: string }) {
  const pages = await listMovedGamePages(kind);
  if (!pages.length) return null;
  return <section className="space-y-4"><h2 className="text-2xl font-semibold">Other games</h2><div className="space-y-4">{pages.map(page => <div key={page.canonical_path}><Link href={page.canonical_path}>{page.title}</Link></div>)}</div></section>;
}

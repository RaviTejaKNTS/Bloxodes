import type { GameCatalogData } from "@/lib/game-page-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function GameCatalog({ data }: { data: GameCatalogData }) {
  // Each short table is a direct ad-stream child, like the Roblox catalog tables.
  const groups = Array.from({ length: Math.ceil(data.items.length / 12) }, (_, index) => data.items.slice(index * 12, index * 12 + 12));
  return <>{groups.map((items, index) => <Table key={index}><TableHeader><TableRow>{data.columns.map(column=><TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{items.map(item=><TableRow key={item.id}>{data.columns.map(column=><TableCell key={column.key}>{item[column.key] == null ? "" : String(item[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table>)}</>;
}

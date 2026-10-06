import type { GameCatalogData } from "@/lib/game-page-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function GameCatalog({ data }: { data: GameCatalogData }) {
  return <Table><TableHeader><TableRow>{data.columns.map(column=><TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map(item=><TableRow key={item.id}>{data.columns.map(column=><TableCell key={column.key}>{item[column.key] == null ? "" : String(item[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table>;
}

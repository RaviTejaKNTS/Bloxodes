import type { ChecklistItem } from "@/lib/db";

function parseCodeParts(code: string): { top: number; child: number | null; leaf: number | null } {
  const parts = code
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => !Number.isNaN(part));

  return {
    top: parts[0] ?? 0,
    child: parts.length > 1 ? parts[1] : null,
    leaf: parts.length > 2 ? parts[2] : null
  };
}

export function ChecklistServerSnapshot({ items }: { items: ChecklistItem[] }) {
  const leafItems = items.filter((item) => parseCodeParts(item.section_code.trim()).leaf !== null);

  if (!leafItems.length) return null;

  return (
    <section className="sr-only" data-server-rendered-checklist>
      <h2>Checklist items</h2>
      <ol>
        {leafItems.map((item) => (
          <li key={item.id}>
            <span>{item.title}</span>
            {item.description ? <p>{item.description}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

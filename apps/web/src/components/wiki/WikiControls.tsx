type ControlDeviceKey = "desktop" | "mobile" | "tablet" | "console" | "vr";

type ControlDeviceColumn = {
  key: ControlDeviceKey;
  label: string;
  enabled?: boolean | null;
};

type ControlTableRow = {
  action: string;
  values: Partial<Record<ControlDeviceKey, string>>;
};

function normalizeText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function formatKeyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stringifyControlValue(value: unknown): string | null {
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(stringifyControlValue).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(", ") : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = record.controls ?? record.keys ?? record.value ?? record.description ?? record.action;
    const preferredText = stringifyControlValue(preferred);
    if (preferredText) return preferredText;
    const parts = Object.entries(record)
      .filter(([key]) => !["device", "platform", "label", "title", "name"].includes(key))
      .map(([key, entry]) => {
        const text = stringifyControlValue(entry);
        return text ? `${formatKeyLabel(key)}: ${text}` : null;
      })
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

const CONTROL_DEVICE_COLUMNS: ControlDeviceColumn[] = [
  { key: "desktop", label: "Desktop" },
  { key: "mobile", label: "Mobile" },
  { key: "tablet", label: "Tablet" },
  { key: "console", label: "Console" },
  { key: "vr", label: "VR" }
];

const CONTROL_DEVICE_ALIASES: Record<ControlDeviceKey, string[]> = {
  desktop: ["desktop", "pc", "computer", "keyboard", "keyboard_mouse", "keyboardMouse"],
  mobile: ["mobile", "phone"],
  tablet: ["tablet"],
  console: ["console", "controller", "xbox", "playstation"],
  vr: ["vr", "virtual_reality", "virtualReality"]
};

function hasDeviceControlValue(raw: unknown, key: ControlDeviceKey): boolean {
  if (!raw) return false;
  if (Array.isArray(raw)) return raw.some((entry) => hasDeviceControlValue(entry, key));
  if (typeof raw !== "object") return false;

  const record = raw as Record<string, unknown>;
  if (CONTROL_DEVICE_ALIASES[key].some((alias) => Boolean(stringifyControlValue(record[alias])))) {
    return true;
  }
  return Object.values(record).some((value) => value && typeof value === "object" && hasDeviceControlValue(value, key));
}

export function getControlDeviceColumns(rawControls: unknown): ControlDeviceColumn[] {
  return CONTROL_DEVICE_COLUMNS.filter((column) => hasDeviceControlValue(rawControls, column.key));
}

function getControlActionLabel(record: Record<string, unknown>, fallback: string): string {
  return (
    stringifyControlValue(record.action) ??
    stringifyControlValue(record.move) ??
    stringifyControlValue(record.label) ??
    stringifyControlValue(record.title) ??
    stringifyControlValue(record.name) ??
    fallback
  );
}

function getDeviceControlValue(record: Record<string, unknown>, key: ControlDeviceKey): string | null {
  for (const alias of CONTROL_DEVICE_ALIASES[key]) {
    const value = stringifyControlValue(record[alias]);
    if (value) return value;
  }
  return null;
}

function parseControlEntry(
  entry: unknown,
  index: number,
  columns: ControlDeviceColumn[],
  labelOverride?: string
): ControlTableRow | null {
  const fallbackLabel = labelOverride ?? `Controls ${index + 1}`;

  if (typeof entry === "string") return null;

  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const action = getControlActionLabel(record, fallbackLabel);
  const values: Partial<Record<ControlDeviceKey, string>> = {};

  for (const column of columns) {
    const value = getDeviceControlValue(record, column.key);
    if (value) values[column.key] = value;
  }

  return Object.keys(values).length ? { action, values } : null;
}

export function parseControls(raw: unknown, columns: ControlDeviceColumn[]): ControlTableRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((entry, index) => parseControlEntry(entry, index, columns))
      .filter((entry): entry is ControlTableRow => Boolean(entry));
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value], index) => parseControlEntry(value, index, columns, formatKeyLabel(key)))
      .filter((entry): entry is ControlTableRow => Boolean(entry));
  }
  return [];
}

export function WikiControlsTable({
  columns,
  heading,
  rows
}: {
  columns: ControlDeviceColumn[];
  heading: string;
  rows: ControlTableRow[];
}) {
  if (!columns.length || !rows.length) return null;

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">{heading}</h2>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-muted/20 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th scope="col" className="min-w-36 border-b border-border/70 px-4 py-3 font-semibold">
                Action
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="min-w-40 border-b border-border/70 px-4 py-3 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.action} className="align-top">
                <th scope="row" className="px-4 py-3 font-semibold text-foreground">
                  {row.action}
                </th>
                {columns.map((column) => {
                  const value = row.values[column.key];
                  return (
                    <td key={column.key} className="px-4 py-3 leading-6 text-muted">
                      {value ? value : <span className="text-muted/60">No control shown</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function WikiControls({ value, heading }: { value: unknown; heading: string }) {
  const columns = getControlDeviceColumns(value);
  return <WikiControlsTable columns={columns} rows={parseControls(value, columns)} heading={heading} />;
}

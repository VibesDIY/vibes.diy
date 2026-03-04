export function getType(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function isTabular(d: unknown): d is Record<string, unknown>[] {
  return (
    Array.isArray(d) &&
    d.length > 0 &&
    d.every((i) => i && typeof i === "object" && !Array.isArray(i))
  );
}

export function byteSize(v: unknown): string {
  const s = JSON.stringify(v).length;
  if (s < 1024) return s + " B";
  if (s < 1048576) return (s / 1024).toFixed(1) + " KB";
  return (s / 1048576).toFixed(1) + " MB";
}

export function flattenRow(
  obj: Record<string, unknown>,
  maxD = 2,
  prefix = "",
  depth = 0
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (getType(v) === "object" && depth < maxD)
      Object.assign(
        out,
        flattenRow(v as Record<string, unknown>, maxD, path, depth + 1)
      );
    else out[path] = v;
  }
  return out;
}

export function smartPreview(v: unknown): string | null {
  const t = getType(v);
  if (t !== "object" && t !== "array") return null;
  if (t === "array") {
    const arr = v as unknown[];
    if (!arr.length) return "[]";
    const inner = arr.map((i) => {
      const it = getType(i);
      if (it === "string") return i as string;
      if (it === "number") return (i as number).toString();
      if (it === "object") {
        const o = i as Record<string, unknown>;
        return (
          o.name || o.title || o.label || o.id || o.sku || o.event || Object.keys(o)[0]
        );
      }
      return String(i);
    });
    const j = inner.join(", ");
    return j.length > 70 ? j.slice(0, 67) + "\u2026" : j;
  }
  const obj = v as Record<string, unknown>;
  const pick = [
    "name",
    "title",
    "label",
    "id",
    "email",
    "status",
    "type",
    "method",
    "event",
  ];
  const display: string[] = [];
  for (const p of pick) {
    if (obj[p] !== undefined)
      display.push(
        `${p}: ${typeof obj[p] === "string" ? (obj[p] as string) : JSON.stringify(obj[p])}`
      );
  }
  if (!display.length)
    for (const k of Object.keys(obj).slice(0, 3)) {
      const val = obj[k];
      display.push(
        `${k}: ${typeof val === "string" ? val : getType(val) === "null" ? "null" : JSON.stringify(val).slice(0, 25)}`
      );
    }
  const j = display.join(" \u00B7 ");
  return j.length > 90 ? j.slice(0, 87) + "\u2026" : j;
}

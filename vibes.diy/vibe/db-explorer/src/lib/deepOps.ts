type PathKey = string | number;
type DeepNode = Record<string, unknown> | unknown[];

function child(obj: DeepNode, key: PathKey): DeepNode {
  return (obj as Record<string | number, unknown>)[key] as DeepNode;
}

function clone(obj: DeepNode): Record<string | number, unknown> | unknown[] {
  return Array.isArray(obj) ? [...obj] : { ...obj };
}

function setChild(c: Record<string | number, unknown> | unknown[], key: PathKey, val: unknown) {
  (c as Record<string | number, unknown>)[key] = val;
}

export function deepSet(obj: DeepNode, path: PathKey[], value: unknown): DeepNode {
  if (!path.length) return value as DeepNode;
  const c = clone(obj);
  setChild(c, path[0], deepSet(child(obj, path[0]), path.slice(1), value));
  return c;
}

export function deepDelete(obj: DeepNode, path: PathKey[]): DeepNode {
  if (path.length === 1) {
    if (Array.isArray(obj)) {
      const c = [...obj];
      c.splice(Number(path[0]), 1);
      return c;
    }
    const c = { ...obj };
    delete c[path[0] as string];
    return c;
  }
  const c = clone(obj);
  setChild(c, path[0], deepDelete(child(obj, path[0]), path.slice(1)));
  return c;
}

export function deepInsert(
  obj: DeepNode,
  path: PathKey[],
  key: string,
  value: unknown
): DeepNode {
  if (!path.length) {
    if (Array.isArray(obj)) return [...obj, value];
    return { ...obj, [key]: value };
  }
  const c = clone(obj);
  setChild(c, path[0], deepInsert(child(obj, path[0]), path.slice(1), key, value));
  return c;
}

export function deepRename(
  obj: DeepNode,
  path: PathKey[],
  oldK: string,
  newK: string
): DeepNode {
  if (oldK === newK) return obj;
  if (!path.length) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k === oldK ? newK : k, v])
    );
  }
  const c = clone(obj);
  setChild(c, path[0], deepRename(child(obj, path[0]), path.slice(1), oldK, newK));
  return c;
}

export function deepMove(
  obj: DeepNode,
  path: PathKey[],
  from: number,
  to: number
): DeepNode {
  if (!path.length && Array.isArray(obj)) {
    const c = [...obj];
    const [item] = c.splice(from, 1);
    c.splice(to, 0, item);
    return c;
  }
  const c = clone(obj);
  setChild(c, path[0], deepMove(child(obj, path[0]), path.slice(1), from, to));
  return c;
}

export function convertType(
  value: unknown,
  from: string,
  to: string
): unknown {
  if (from === to) return value;
  if (to === "null") return null;
  if (to === "string")
    return from === "object" || from === "array"
      ? JSON.stringify(value)
      : String(value ?? "");
  if (to === "number") {
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  }
  if (to === "boolean")
    return from === "string"
      ? value === "true" || value === "1"
      : Boolean(value);
  if (to === "object") return {};
  if (to === "array") return [];
  return value;
}

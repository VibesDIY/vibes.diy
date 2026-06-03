import { type QueryFilter } from "@vibes.diy/api-types";

function isInInclusiveRange(value: unknown, lo: unknown, hi: unknown): boolean {
  if (typeof value === "string" && typeof lo === "string" && typeof hi === "string") {
    return value >= lo && value <= hi;
  }
  if (typeof value === "number" && typeof lo === "number" && typeof hi === "number") {
    return value >= lo && value <= hi;
  }
  if (typeof value === "bigint" && typeof lo === "bigint" && typeof hi === "bigint") {
    return value >= lo && value <= hi;
  }
  if (typeof value === "boolean" && typeof lo === "boolean" && typeof hi === "boolean") {
    return Number(value) >= Number(lo) && Number(value) <= Number(hi);
  }
  return false;
}

export function applyQueryFilter(
  docs: ({ _id: string } & Record<string, unknown>)[],
  filter: QueryFilter | undefined
): ({ _id: string } & Record<string, unknown>)[] {
  if (!filter) return docs;
  const { field, key, keys, range } = filter;
  if (key !== undefined) {
    return docs.filter((doc) => doc[field] === key);
  }
  if (keys !== undefined) {
    const keySet = new Set(keys);
    return docs.filter((doc) => keySet.has(doc[field]));
  }
  if (range !== undefined) {
    const [lo, hi] = range;
    return docs.filter((doc) => isInInclusiveRange(doc[field], lo, hi));
  }
  return docs;
}

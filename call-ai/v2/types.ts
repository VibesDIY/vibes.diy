import { type } from "arktype";

// Coerce Date - accepts Date instance or string/number and converts to Date
// export const CoercedDate = type("Date | string | number").pipe((v) => (v instanceof Date ? v : new Date(v)));
export const CoercedDate = type("string.date.iso.parse | Date");
// export const CoercedDate = type("Date")
export type CoercedDate = typeof CoercedDate.infer;

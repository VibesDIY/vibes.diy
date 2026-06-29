// The `▸` option-line parser now lives in the browser-safe leaf package
// `@vibes.diy/api-types` so the server's anonymous chip-projection endpoint
// (`getVibeChips`, #2755) and the frontend share ONE implementation with no
// drift. This module re-exports it so existing importers (MessageList, the
// option-lines test) keep their paths unchanged.
export { parseOptionLines, type ParsedMessage, type ParseOptionLinesOptions } from "@vibes.diy/api-types";

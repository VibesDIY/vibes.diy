/**
 * Vibes theme — public API.
 */

import { Lazy } from "@adviser/cement";
import { buildGlobalCSS } from "./global-styles.js";

export { cx } from "@emotion/css";

export { colors, semantic } from "./tokens.js";
export type { SemanticTheme } from "./tokens.js";

export {
  brutalistPress,
  bgGlimmer,
  borderGlimmer,
  glimmerOverlay,
  stripesOverlay,
  gridBackground,
} from "./patterns.js";

const cachedCSS = Lazy(() => buildGlobalCSS());

/** Complete global CSS string for SSR <style> injection. */
export function getVibesGlobalCSS(): string {
  return cachedCSS();
}

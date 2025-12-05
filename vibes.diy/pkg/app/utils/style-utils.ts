/**
 * Utility functions for managing component styling
 */

import type { ImgGenClasses } from "@vibes.diy/use-vibes-types";

export type { ImgGenClasses };

/**
 * Combines multiple class names into a single string, filtering out falsy values
 * Also adds backward compatibility class names for testing and legacy support
 *
 * @example
 * // Returns "foo bar baz"
 * combineClasses('foo', 'bar', 'baz')
 *
 * @example
 * // Returns "btn btn-primary"
 * combineClasses('btn', condition && 'btn-primary', false && 'btn-large')
 *
 * @example
 * // Returns "imggen-root img-gen-container" (with legacy class name)
 * combineClasses('imggen-root', classes.root)
 */
export function combineClasses(
  ...classes: (string | boolean | null | undefined)[]
): string {
  // Filter out falsy values
  const validClasses = classes.filter(Boolean) as string[];

  // Add backward compatibility classes (img-gen-* format)
  const allClasses = [...validClasses];

  // For each imggen-* class, add a corresponding img-gen-* class for backward compatibility
  validClasses.forEach((cls) => {
    if (cls.startsWith("imggen-")) {
      // Convert imggen-root to img-gen-root, etc.
      const legacyClass = cls.replace("imggen-", "img-gen-");
      // Only add if not already present
      if (!allClasses.includes(legacyClass)) {
        allClasses.push(legacyClass);
      }
    }
  });

  return allClasses.join(" ");
}

/**
 * Default empty classes object
 */
export const defaultClasses: Partial<ImgGenClasses> = {};

/**
 * Utility functions for managing component styling
 */

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
export function combineClasses(...classes: (string | boolean | null | undefined)[]): string {
  // Filter out falsy values
  const validClasses = classes.filter(Boolean) as string[];

  // Add backward compatibility classes (img-gen-* format)
  const allClasses = [...validClasses];

  // For each imggen-* class, add a corresponding img-gen-* class for backward compatibility
  validClasses.forEach((cls) => {
    if (cls.startsWith('imggen-')) {
      // Convert imggen-root to img-gen-root, etc.
      const legacyClass = cls.replace('imggen-', 'img-gen-');
      // Only add if not already present
      if (!allClasses.includes(legacyClass)) {
        allClasses.push(legacyClass);
      }
    }
  });

  return allClasses.join(' ');
}

/**
 * Type definitions for component classes props pattern
 */
export interface ImgGenClasses {
  /** Root container class */
  readonly root: string;
  /** Image container class */
  readonly container: string;
  /** Image element class */
  readonly image: string;
  /** Overlay panel class */
  readonly overlay: string;
  /** Progress indicator class */
  readonly progress: string;
  /** Placeholder element class */
  readonly placeholder: string;
  /** Error container class */
  readonly error: string;
  /** Control buttons container class */
  readonly controls: string;
  /** Button class */
  readonly button: string;
  /** Prompt container class */
  readonly prompt: string;
  /** Delete confirmation overlay class */
  readonly deleteOverlay: string;
  /** Drop zone class for file uploads */
  readonly dropZone: string;
  /** Upload waiting container class */
  readonly uploadWaiting: string;
}

/**
 * Default empty classes object
 */
export const defaultClasses: Partial<ImgGenClasses> = {};

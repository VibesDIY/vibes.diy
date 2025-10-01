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

export * from './vibes-gen-types.js';
export * from './image-gen-types.js';

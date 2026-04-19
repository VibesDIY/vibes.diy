// Type definitions for ImgVibes components
import type { PartialImageDocument } from "@vibes.diy/use-vibes-types";
import { ImgVibesClasses } from "../../utils/style-utils.js";

// Props for the placeholder component
export interface ImgVibesPlaceholderProps {
  readonly className?: string;
  readonly alt?: string;
  readonly prompt?: string;
  progress: number;
  /** Whether the component is currently loading */
  readonly loading?: boolean;
  readonly error?: Error | null;
  readonly classes?: Partial<ImgVibesClasses>;
}

// Props for the image display component
export interface ImgVibesDisplayProps {
  readonly document: PartialImageDocument;
  readonly className: string;
  readonly alt: string;
  /** Callback when delete is confirmed - receives document ID */
  readonly onDelete: (id: string) => void;
  /** Callback when regeneration is requested - receives document ID */
  readonly onRegen: (id: string) => void;
  /** Callback when prompt is edited - receives document ID and new prompt */
  readonly onPromptEdit: (id: string, newPrompt: string) => void;
  /** Custom CSS classes for styling component parts */
  readonly classes: Partial<ImgVibesClasses>;
  /** Whether the component is currently loading */
  readonly loading: boolean;
  /** Generation progress as a number between 0-100 */
  readonly progress: number;
  /** Error if image generation failed */
  readonly error: Error | null;
  /** Enable debug logging */
  readonly debug: boolean;
}

// Props for the error component
export interface ImgVibesErrorProps {
  /** Optional error message to display */
  readonly message: string;
  /** Optional CSS class name */
  readonly className: string;
  /** Custom CSS classes for styling component parts */
  readonly classes: Partial<ImgVibesClasses>;
}

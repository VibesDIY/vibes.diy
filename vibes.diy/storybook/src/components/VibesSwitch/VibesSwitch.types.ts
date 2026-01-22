/**
 * VibesSwitch Component Types
 */

export interface VibesSwitchProps {
  /**
   * Size of the switch (number in pixels or CSS string)
   * @default 24
   */
  size?: number | string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Controlled active state
   */
  isActive?: boolean;

  /**
   * Toggle handler callback
   */
  onToggle?: (active: boolean) => void;
}

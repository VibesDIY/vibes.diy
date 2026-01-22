/**
 * HiddenMenuWrapper Component Types
 */

import type { ReactNode } from 'react';

export interface HiddenMenuWrapperProps {
  /**
   * Main content to display
   */
  children: ReactNode;

  /**
   * Content to display in the hidden menu
   */
  menuContent: ReactNode;

  /**
   * Trigger bounce animation
   */
  triggerBounce?: boolean;

  /**
   * Show the VibesSwitch toggle button
   * @default true
   */
  showVibesSwitch?: boolean;
}

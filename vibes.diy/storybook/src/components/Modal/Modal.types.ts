/**
 * Modal Component Types
 */

import type { ReactNode } from 'react';

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title?: string;

  /**
   * Modal content
   */
  children: ReactNode;

  /**
   * Maximum width of modal
   * @default '800px'
   */
  maxWidth?: string;
}

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { VibeControl, VibeControlProps } from './components/VibeControl.js';

/**
 * Mount function for using VibeControl in non-React environments
 *
 * This allows embedding the VibeControl component into any web page,
 * similar to how other widget libraries work.
 */
export interface MountVibeControlOptions extends VibeControlProps {
  /** Container element or selector where to mount the component */
  readonly container?: string | HTMLElement | null;
}

export interface MountVibeControlResult {
  /** Unmount the component and cleanup */
  unmount: () => void;

  /** Update the component props */
  update: (newProps: Partial<VibeControlProps>) => void;

  /** Get the current props */
  getProps: () => VibeControlProps;

  /** Get the container element */
  getContainer: () => HTMLElement | null;
}

/**
 * Mounts a VibeControl component to a DOM element
 *
 * @param options - Configuration options including container and component props
 * @returns Object with unmount function and other utilities
 *
 * @example
 * ```typescript
 * // Mount to a specific element
 * const control = mountVibeControl({
 *   container: '#vibe-control-container',
 *   label: 'My Vibes',
 *   onOpen: () => console.log('Opened!'),
 *   children: React.createElement('div', {}, 'Custom content')
 * });
 *
 * // Later, unmount
 * control.unmount();
 * ```
 *
 * @example
 * ```typescript
 * // Mount to body (default)
 * const control = mountVibeControl({
 *   position: 'bottom-left',
 *   label: 'Settings'
 * });
 * ```
 */
export function mountVibeControl(options: MountVibeControlOptions = {}): MountVibeControlResult {
  const { container: containerOption, ...vibeControlProps } = options;

  // Resolve container element
  let containerElement: HTMLElement | null = null;

  if (containerOption === null) {
    containerElement = null;
  } else if (typeof containerOption === 'string') {
    containerElement = document.querySelector(containerOption);
    if (!containerElement) {
      throw new Error(`VibeControl mount container not found: ${containerOption}`);
    }
  } else if (containerOption instanceof HTMLElement) {
    containerElement = containerOption;
  } else {
    // Default to document.body
    containerElement = document.body;
  }

  if (!containerElement) {
    throw new Error('VibeControl mount container is required');
  }

  // Create a div to mount the component into
  const mountDiv = document.createElement('div');
  mountDiv.style.position = 'relative';
  mountDiv.style.zIndex = '1000';
  containerElement.appendChild(mountDiv);

  // Create React root
  const root = ReactDOM.createRoot(mountDiv);

  // Keep track of current props for updates
  let currentProps: VibeControlProps = { ...vibeControlProps };

  // Render the component
  const render = (props: VibeControlProps) => {
    root.render(React.createElement(VibeControl, props));
  };

  // Initial render
  render(currentProps);

  // Return control object
  return {
    unmount: () => {
      root.unmount();
      if (mountDiv.parentNode) {
        mountDiv.parentNode.removeChild(mountDiv);
      }
    },

    update: (newProps: Partial<VibeControlProps>) => {
      currentProps = { ...currentProps, ...newProps };
      render(currentProps);
    },

    getProps: () => ({ ...currentProps }),

    getContainer: () => containerElement,
  };
}

/**
 * Convenience function to mount VibeControl to document.body
 *
 * @param props - VibeControl props
 * @returns Mount control object
 */
export function mountVibeControlToBody(props: VibeControlProps = {}): MountVibeControlResult {
  return mountVibeControl({
    container: document.body,
    ...props,
  });
}

/**
 * Auto-mount function that can be called from a script tag
 *
 * This looks for a global configuration object and auto-mounts the component.
 * Useful for embedding via CDN.
 *
 * @example
 * ```html
 * <script>
 *   window.VIBE_CONTROL_CONFIG = {
 *     label: 'My App Controls',
 *     position: 'bottom-left'
 *   };
 * </script>
 * <script src="https://esm.sh/use-vibes/vibe-control-mount.js"></script>
 * <script>autoMountVibeControl();</script>
 * ```
 */
export function autoMountVibeControl(): MountVibeControlResult | null {
  // Check for global configuration
  const globalConfig = (window as unknown as Record<string, unknown>).VIBE_CONTROL_CONFIG;

  if (!globalConfig) {
    console.warn('VibeControl: No global VIBE_CONTROL_CONFIG found for auto-mount');
    return null;
  }

  try {
    return mountVibeControlToBody(globalConfig);
  } catch (error) {
    console.error('VibeControl: Auto-mount failed:', error);
    return null;
  }
}

// Export the main mount function as default
export default mountVibeControl;

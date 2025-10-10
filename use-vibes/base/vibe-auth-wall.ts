import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWallProps, AuthWall } from './components/AuthWall/AuthWall.js';

/**
 * Mount function options for AuthWall
 */
export interface MountAuthWallOptions extends AuthWallProps {
  /** DOM container or selector where the component will be mounted */
  readonly container?: string | HTMLElement;
}

/**
 * Object returned after mounting AuthWall
 */
export interface MountAuthWallResult {
  /** Unmount and clean up */
  unmount: () => void;

  /** Update component props */
  update: (newProps: Partial<AuthWallProps>) => void;

  /** Get current props */
  getProps: () => AuthWallProps;

  /** Get container DOM element */
  getContainer: () => HTMLElement;
}

/**
 * Mounts the AuthWall component to a DOM element
 */
export function mountAuthWall(
  options: MountAuthWallOptions = {
    onLogin: function (): void {
      throw new Error('Function not implemented.');
    },
    imageUrl: '',
    title: '',
    open: false,
  }
): MountAuthWallResult {
  const { container: containerOption, ...authWallProps } = options;

  // Resolve the container
  let containerElement: HTMLElement;
  if (typeof containerOption === 'string') {
    const el = document.querySelector(containerOption);
    if (!el) throw new Error(`AuthWall mount container not found: ${containerOption}`);
    containerElement = el as HTMLElement;
  } else if (containerOption instanceof HTMLElement) {
    containerElement = containerOption;
  } else {
    containerElement = document.body;
  }

  // Create a div to hold the mounted React component
  const mountDiv = document.createElement('div');
  containerElement.appendChild(mountDiv);

  // Create React root
  const root = ReactDOM.createRoot(mountDiv);

  // Track props internally for updates
  let currentProps: AuthWallProps = { ...authWallProps };

  // Render function
  const render = (props: AuthWallProps) => {
    root.render(React.createElement(AuthWall, props));
  };

  // Initial render
  render(currentProps);

  return {
    unmount: () => {
      root.unmount();
      if (mountDiv.parentNode) {
        mountDiv.parentNode.removeChild(mountDiv);
      }
    },

    update: (newProps: Partial<AuthWallProps>) => {
      currentProps = { ...currentProps, ...newProps };
      render(currentProps);
    },

    getProps: () => ({ ...currentProps }),

    getContainer: () => containerElement,
  };
}

/**
 * Convenience mount to document.body
 */
export function mountAuthWallToBody(props: AuthWallProps): MountAuthWallResult {
  return mountAuthWall({ container: document.body, ...props });
}

/**
 * Auto-mount AuthWall using global window.AUTH_WALL_CONFIG
 */
export function autoMountAuthWall(): MountAuthWallResult | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('AuthWall: autoMountAuthWall called in non-browser environment');
    return null;
  }

  const tryMount = (): MountAuthWallResult | null => {
    const globalConfig = (window as unknown as { AUTH_WALL_CONFIG?: AuthWallProps })
      .AUTH_WALL_CONFIG;
    if (!globalConfig) {
      console.warn('AuthWall: No global AUTH_WALL_CONFIG found');
      return null;
    }

    try {
      return mountAuthWallToBody(globalConfig);
    } catch (error) {
      console.error('AuthWall: Auto-mount failed:', error);
      return null;
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', tryMount, { once: true });
    return null;
  }

  return tryMount();
}

// Default export
export default mountAuthWall;

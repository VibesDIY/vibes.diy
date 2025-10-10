import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  HiddenMenuWrapper,
  HiddenMenuWrapperProps,
} from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';

/**
 * Extend the Window interface to include HIDDEN_MENU_WRAPPER_CONFIG
 */
declare global {
  interface Window {
    HIDDEN_MENU_WRAPPER_CONFIG?: HiddenMenuWrapperProps;
  }
}

/**
 * Options to mount HiddenMenuWrapper
 */
export interface MountHiddenMenuWrapperOptions extends HiddenMenuWrapperProps {
  /** Container element or selector */
  readonly container?: string | HTMLElement;
}

/**
 * Return value from mountHiddenMenuWrapper
 */
export interface MountHiddenMenuWrapperResult {
  unmount: () => void;
  update: (newProps: Partial<HiddenMenuWrapperProps>) => void;
  getProps: () => HiddenMenuWrapperProps;
  getContainer: () => HTMLElement;
}

/**
 * Mounts HiddenMenuWrapper into a DOM container
 */
export function mountHiddenMenuWrapper(
  options: MountHiddenMenuWrapperOptions = {
    children: undefined,
    menuContent: undefined,
  }
): MountHiddenMenuWrapperResult {
  const { container: containerOption, ...initialProps } = options;

  let containerElement: HTMLElement;
  if (typeof containerOption === 'string') {
    const found = document.querySelector(containerOption);
    if (!found) {
      throw new Error(`HiddenMenuWrapper container not found: ${containerOption}`);
    }
    containerElement = found as HTMLElement;
  } else if (containerOption instanceof HTMLElement) {
    containerElement = containerOption;
  } else {
    containerElement = document.body;
  }

  const mountDiv = document.createElement('div');
  containerElement.appendChild(mountDiv);

  const root = ReactDOM.createRoot(mountDiv);

  let currentProps: HiddenMenuWrapperProps = { ...initialProps };

  const render = (props: HiddenMenuWrapperProps) => {
    root.render(React.createElement(HiddenMenuWrapper, props));
  };

  render(currentProps);

  return {
    unmount: () => {
      root.unmount();
      if (mountDiv.parentNode) {
        mountDiv.parentNode.removeChild(mountDiv);
      }
    },

    update: (newProps: Partial<HiddenMenuWrapperProps>) => {
      currentProps = { ...currentProps, ...newProps };
      render(currentProps);
    },

    getProps: () => ({ ...currentProps }),

    getContainer: () => containerElement,
  };
}

/**
 * Mounts the HiddenMenuWrapper directly to document.body
 */
export function mountHiddenMenuWrapperToBody(
  props: HiddenMenuWrapperProps = {
    children: undefined,
    menuContent: undefined,
  }
): MountHiddenMenuWrapperResult {
  const { menuContent, ...restProps } = props;
  return mountHiddenMenuWrapper({
    container: document.body,
    menuContent: menuContent || React.createElement(VibesPanel),
    ...restProps,
  });
}

/**
 * Automatically mounts HiddenMenuWrapper if `window.HIDDEN_MENU_WRAPPER_CONFIG` is defined
 *
 * @example
 * ```html
 * <script>
 *   window.HIDDEN_MENU_WRAPPER_CONFIG = {
 *     menuContent: React.createElement('div', {}, 'Hello!'),
 *     children: React.createElement('div', {}, 'Main app'),
 *   };
 * </script>
 * <script src="https://cdn.example.com/mountHiddenMenuWrapper.js"></script>
 * <script>
 *   autoMountHiddenMenuWrapper();
 * </script>
 * ```
 */
export function autoMountHiddenMenuWrapper(): MountHiddenMenuWrapperResult | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('HiddenMenuWrapper: autoMount called in non-browser environment');
    return null;
  }

  const config = window.HIDDEN_MENU_WRAPPER_CONFIG;

  if (!config) {
    console.warn('HiddenMenuWrapper: No HIDDEN_MENU_WRAPPER_CONFIG found');
    return null;
  }

  try {
    return mountHiddenMenuWrapperToBody(config);
  } catch (error) {
    console.error('HiddenMenuWrapper: Auto-mount failed:', error);
    return null;
  }
}

import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import {
  getWrapperStyle,
  getMenuStyle,
  getContentWrapperStyle,
  getContentStyle,
  getToggleButtonStyle,
  getInnerContentWrapperStyle,
  getButtonDevIndicatorStyle,
} from "./HiddenMenuWrapper.styles";
import { VibesSwitch } from "../VibesSwitch/VibesSwitch";
import { Modal } from "../Modal/Modal";
import { TokensEditor } from "../TokensEditor/TokensEditor";
import { useIsDevelopment } from "../../utils";
import type { HiddenMenuWrapperProps } from "./HiddenMenuWrapper.types";

export const HiddenMenuWrapper: React.FC<HiddenMenuWrapperProps> = ({
  children,
  menuContent,
  triggerBounce,
  showVibesSwitch = true,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  type TimerId = number | ReturnType<typeof setTimeout>;
  const rafIdRef = useRef<TimerId | null>(null);
  const cancelRef = useRef<null | ((id: TimerId) => void)>(null);

  const [isBouncing, setIsBouncing] = useState(false);
  const [hasBouncedOnMount, setHasBouncedOnMount] = useState(false);
  const [isTokensModalOpen, setIsTokensModalOpen] = useState(false);

  const isDevelopment = useIsDevelopment();

  useEffect(() => {
    if (!hasBouncedOnMount && !menuOpen) {
      const prefersReducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
        false;
      if (!prefersReducedMotion) {
        setIsBouncing(true);
        setTimeout(() => setIsBouncing(false), 800);
      }
      setHasBouncedOnMount(true);
    }
  }, [hasBouncedOnMount, menuOpen]);

  useEffect(() => {
    const styleId = "vibes-drop-to-close-keyframes";
    const existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes vibes-drop-to-close {
          0%   { transform: translateY(-400px); }
          10%  { transform: translateY(0); }
          25%  { transform: translateY(-175px); }
          35%  { transform: translateY(0); }
          48%  { transform: translateY(-75px); }
          62%  { transform: translateY(0); }
          72%  { transform: translateY(-25px); }
          80%  { transform: translateY(0); }
          82%  { transform: translateY(-10px); }
          88%  { transform: translateY(0); }
          91%  { transform: translateY(-5px); }
          95%  { transform: translateY(0); }
          100% { transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (triggerBounce) {
      setIsBouncing(true);
      const timeout = setTimeout(() => setIsBouncing(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [triggerBounce]);

  useEffect(() => {
    if (menuRef.current) {
      const next = menuRef.current.offsetHeight;
      setMenuHeight((prev) => (prev !== next ? next : prev));
    }
  }, [menuContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }

      if (menuOpen && e.key === "Tab" && menuContainerRef.current) {
        const focusableElements =
          menuContainerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (!first || !last) return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }
  }, [menuOpen]);

  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;

    const scheduleSetHeight = (h: number) => {
      if (rafIdRef.current != null && cancelRef.current) {
        cancelRef.current(rafIdRef.current);
        rafIdRef.current = null;
      }

      const run = () => setMenuHeight((prev) => (prev !== h ? h : prev));

      if (typeof requestAnimationFrame !== "undefined") {
        const id = requestAnimationFrame(() => run());
        rafIdRef.current = id;
        cancelRef.current = (cancelId: TimerId) =>
          cancelAnimationFrame(cancelId as number);
      } else {
        const id = setTimeout(run, 0);
        rafIdRef.current = id;
        cancelRef.current = (cancelId: TimerId) =>
          clearTimeout(cancelId as ReturnType<typeof setTimeout>);
      }
    };

    scheduleSetHeight(menuEl.offsetHeight);

    if (
      typeof (window as unknown as { ResizeObserver?: typeof ResizeObserver })
        .ResizeObserver !== "undefined"
    ) {
      const RO = (
        window as unknown as { ResizeObserver: typeof ResizeObserver }
      ).ResizeObserver;
      const resizeObserver = new RO(() => {
        scheduleSetHeight(menuEl.offsetHeight);
      });

      resizeObserver.observe(menuEl);

      return () => {
        resizeObserver.disconnect();
        if (rafIdRef.current != null && cancelRef.current) {
          cancelRef.current(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }

    const mutationObserver = new MutationObserver(() => {
      scheduleSetHeight(menuEl.offsetHeight);
    });
    mutationObserver.observe(menuEl, { childList: true, subtree: true });

    const onResize = () => scheduleSetHeight(menuEl.offsetHeight);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (rafIdRef.current != null && cancelRef.current) {
        cancelRef.current(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;
    const defer = (cb: () => void) => {
      if (typeof queueMicrotask === "function") {
        queueMicrotask(cb);
      } else if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(cb);
      } else {
        setTimeout(cb, 0);
      }
    };

    defer(() => {
      const next = menuEl.offsetHeight;
      setMenuHeight((prev) => (prev !== next ? next : prev));
    });
  }, [menuOpen]);

  return (
    <div style={getWrapperStyle()}>
      <div
        id="hidden-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Hidden menu"
        aria-hidden={!menuOpen}
        ref={menuRef}
        style={getMenuStyle()}
      >
        {menuContent}
      </div>

      <div
        style={getContentWrapperStyle(menuHeight, menuOpen, isBouncing)}
        ref={menuContainerRef}
      >
        <div style={getInnerContentWrapperStyle(menuOpen)}>
          <div style={getContentStyle()}>{children}</div>
        </div>
      </div>

      {showVibesSwitch && (
        <button
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="hidden-menu"
          ref={buttonRef}
          onClick={() => setMenuOpen(!menuOpen)}
          style={getToggleButtonStyle()}
        >
          <VibesSwitch size={80} />
        </button>
      )}

      {isDevelopment && (
        <button
          style={getButtonDevIndicatorStyle()}
          title="Development Mode - Edit Design"
          onClick={() => setIsTokensModalOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}

      {isDevelopment && (
        <Modal
          isOpen={isTokensModalOpen}
          onClose={() => setIsTokensModalOpen(false)}
          title="Edit Design Tokens"
          maxWidth="1200px"
        >
          <TokensEditor />
        </Modal>
      )}
    </div>
  );
};

HiddenMenuWrapper.displayName = 'HiddenMenuWrapper';

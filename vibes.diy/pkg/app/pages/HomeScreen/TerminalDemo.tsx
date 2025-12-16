import React, { useEffect, useRef, useState } from "react";

// jQuery Terminal type declarations
declare global {
  interface Window {
    $?: JQueryStatic & {
      fn: {
        terminal: (
          interpreter: (() => void) | Record<string, unknown>,
          options: Record<string, unknown>,
        ) => JQueryTerminal;
      };
    };
    jQuery?: unknown;
  }
}

interface JQueryStatic {
  (selector: HTMLElement | null): JQueryElement;
}

interface JQueryElement {
  terminal: (
    interpreter: (() => void) | Record<string, unknown>,
    options: Record<string, unknown>,
  ) => JQueryTerminal;
}

interface JQueryTerminal {
  echo: (text: string) => void;
  typing: (
    method: string,
    delay: number,
    text: string,
    callback?: () => void,
  ) => void;
  clear: () => void;
  destroy: () => void;
  set_prompt: (prompt: string) => void;
  disable: () => void;
  enable: () => void;
}

// Terminal Demo component with CRT effect and typing animation
export const TerminalDemo = ({ isMobile }: { isMobile: boolean }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<JQueryTerminal | null>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  // Dynamically load jQuery and jQuery Terminal scripts
  useEffect(() => {
    let cancelled = false;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if script tag already exists
        const existingScript = document.querySelector(
          `script[src="${src}"]`,
        ) as HTMLScriptElement | null;
        if (existingScript) {
          // If script exists, wait for it to load if not already
          if (existingScript.dataset.loaded === "true") {
            resolve();
          } else {
            existingScript.addEventListener("load", () => resolve());
            existingScript.addEventListener("error", () =>
              reject(new Error(`Failed to load ${src}`)),
            );
          }
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = false; // Load synchronously to ensure order
        script.onload = () => {
          script.dataset.loaded = "true";
          resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadStyles = (href: string): void => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    };

    const waitForJQueryTerminal = (): Promise<void> => {
      return new Promise((resolve) => {
        const check = () => {
          if (
            window.$ &&
            typeof window.$ === "function" &&
            window.$.fn &&
            typeof window.$.fn.terminal === "function"
          ) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    };

    const loadDependencies = async () => {
      try {
        // Load styles first
        loadStyles(
          "https://cdn.jsdelivr.net/npm/jquery.terminal/css/jquery.terminal.min.css",
        );

        // Load jQuery first
        await loadScript("https://cdn.jsdelivr.net/npm/jquery");

        // Then jQuery Terminal
        await loadScript(
          "https://cdn.jsdelivr.net/npm/jquery.terminal/js/jquery.terminal.min.js",
        );

        // Wait for jQuery Terminal plugin to be available
        await waitForJQueryTerminal();

        if (!cancelled) {
          setScriptsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load terminal dependencies:", error);
      }
    };

    loadDependencies();

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize terminal once scripts are loaded
  useEffect(() => {
    if (
      !scriptsLoaded ||
      !terminalRef.current ||
      !window.$ ||
      typeof window.$.fn?.terminal !== "function"
    ) {
      return;
    }

    const $ = window.$;
    let animationActive = true;
    let hasSubmitted = false;

    const responseLines = [
      {
        text: "A simple target. Let me mutate your local app state",
        delay: 25,
      },
      { text: "and let the library worry about the network.", delay: 25 },
      { text: "", delay: 400 },
      { text: "LLMs are great at local JavaScript state.", delay: 25 },
      { text: "They're bad at distributed systems.", delay: 25 },
      { text: "", delay: 300 },
      { text: "Why?", delay: 30 },
      { text: "", delay: 400 },
      { text: "I reason inside language, not across networks.", delay: 25 },
      {
        text: "Code and local state are expressed directly in text,",
        delay: 25,
      },
      { text: "inside a single context.", delay: 25 },
      { text: "", delay: 300 },
      { text: "Network calls, servers, retries, timeouts, and", delay: 25 },
      { text: "eventual consistency exist outside that context.", delay: 25 },
      { text: "", delay: 300 },
      { text: "When you ask me to generate a traditional web app,", delay: 25 },
      { text: "you're asking me to reason about:", delay: 25 },
      { text: "  • things happening later,", delay: 20 },
      { text: "  • somewhere else,", delay: 20 },
      { text: "  • possibly not at all.", delay: 20 },
      { text: "", delay: 300 },
      { text: "That's friction.", delay: 30 },
      { text: "", delay: 400 },
      { text: "The local-first Vibes DIY web stack removes it.", delay: 25 },
    ];

    let lineIndex = 0;

    const typeResponseLines = (term: JQueryTerminal) => {
      if (!animationActive) return;

      if (lineIndex >= responseLines.length) {
        // Done - don't loop
        return;
      }

      const line = responseLines[lineIndex];
      if (line.text === "") {
        term.echo("");
        lineIndex++;
        setTimeout(() => typeResponseLines(term), line.delay);
      } else {
        term.typing("echo", line.delay, line.text, () => {
          lineIndex++;
          setTimeout(() => typeResponseLines(term), 200);
        });
      }
    };

    // Save scroll position before terminal initialization to prevent auto-scroll
    // Find the main scroll container (look for parent with overflow-y: auto or scroll)
    let scrollContainer: HTMLElement | null = null;
    let element = terminalRef.current?.parentElement;
    while (element) {
      const style = window.getComputedStyle(element);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        scrollContainer = element;
        break;
      }
      element = element.parentElement;
    }
    const savedScrollTop = scrollContainer?.scrollTop || window.scrollY;

    // Create terminal with command handler for Enter key
    const term = $(terminalRef.current).terminal(
      function (this: JQueryTerminal) {
        // When user presses Enter (submits anything)
        if (hasSubmitted) return;
        hasSubmitted = true;

        // Disable further input
        this.set_prompt("");
        this.disable();

        // Show response
        this.echo("");
        typeResponseLines(this);
      },
      {
        greetings: false,
        prompt: "[[;#888;]Press Enter to continue...] ",
        enabled: true,
        clickTimeout: null,
        keypress: function (e: KeyboardEvent) {
          // Block all character input (but not special keys like Enter)
          if (e.key.length === 1) {
            return false;
          }
        },
      },
    );

    termRef.current = term;

    // Prevent terminal from auto-focusing on external clicks
    const preventExternalFocus = (e: MouseEvent) => {
      // If click is outside the terminal container, blur the terminal
      if (
        terminalRef.current &&
        !terminalRef.current.contains(e.target as Node)
      ) {
        // Blur any focused element within the terminal
        const activeElement = document.activeElement;
        if (activeElement && terminalRef.current.contains(activeElement)) {
          (activeElement as HTMLElement).blur();
        }
      }
    };

    document.addEventListener("click", preventExternalFocus, true);

    // Restore scroll position after terminal initialization
    requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop;
      } else {
        window.scrollTo(0, savedScrollTop);
      }
    });

    // Claude Code CLI parody - Vibes DIY style (narrow version ~45 chars)
    const orange = "#DA291C";
    const yellow = "#FEDD00";
    const blue = "#009ACE";
    const cream = "var(--vibes-cream)";
    const dimGray = "#555";

    // Narrow box (44 chars wide total, 42 inner)
    term.echo(`[[;${orange};]  ╭──────────────────────────────────────────╮]`);
    term.echo(
      `[[;${orange};]  │              [[;${yellow};]Vibes OS v.0.1[[;${orange};]              │]`,
    );
    term.echo(`[[;${orange};]  │                                          │]`);
    term.echo(
      `[[;${orange};]  │           [[;${cream};]Welcome, Vibe Coder![[;${orange};]           │]`,
    );
    term.echo(`[[;${orange};]  │                                          │]`);
    term.echo(
      `[[;${orange};]  │                  [[;${orange};] [[;${blue};]^__^[[;${orange};][[;${orange};]                   │]`,
    );
    term.echo(`[[;${orange};]  │                                          │]`);
    term.echo(
      `[[;${orange};]  │         [[;${blue};]Vibes 4.5[[;${orange};] · [[;${yellow};]Local-First[[;${orange};]          │]`,
    );
    term.echo(
      `[[;${orange};]  │          [[;${dimGray};]~/your-brilliant-idea[[;${orange};]           │]`,
    );
    term.echo(`[[;${orange};]  ╰──────────────────────────────────────────╯]`);
    term.echo("");
    term.echo(`[[;${blue};]> What do you actually want to generate?]`);
    term.echo("");

    return () => {
      animationActive = false;
      document.removeEventListener("click", preventExternalFocus, true);
      if (termRef.current) {
        termRef.current.destroy();
        termRef.current = null;
      }
    };
  }, [scriptsLoaded]);

  // CRT container styles
  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    minWidth: "350px",
    maxWidth: isMobile ? "100%" : "600px",
    height: isMobile ? "380px" : "283px",
    marginTop: "24px",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    boxShadow:
      "0 0 20px rgba(0, 255, 0, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.5)",
    border: "2px solid #333",
  };

  // Scanline/noise overlay
  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.15,
    zIndex: 1,
    pointerEvents: "none",
    backgroundImage: `
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.1) 2px, rgba(255, 255, 255, 0.1) 4px),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")
    `,
    backgroundSize: "100% 4px, 100px 100px",
    animation: "staticNoise 0.3s steps(1) infinite",
  };

  // Terminal div styles
  const terminalStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    pointerEvents: "auto",
  };

  return (
    <div style={containerStyle}>
      <style>
        {`
          .terminal-demo .terminal {
            --color: rgba(0, 255, 0, 0.9);
            --background: transparent;
            --size: ${isMobile ? "1" : "1.2"};
            --font: 'Courier New', monospace;
          }
          .terminal-demo .terminal .cmd {
            pointer-events: none;
          }
          .terminal-demo .terminal textarea,
          .terminal-demo .terminal .cmd-cursor-line {
            pointer-events: none !important;
          }
        `}
      </style>
      <div style={overlayStyle} />
      <div ref={terminalRef} className="terminal-demo" style={terminalStyle} />
    </div>
  );
};

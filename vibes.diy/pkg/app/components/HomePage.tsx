import React, { useCallback, useEffect, useRef, useState } from "react";
import SessionSidebar from "./SessionSidebar.js";
import { quickSuggestions } from "../data/quick-suggestions-data.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { useNavigate } from "react-router";
import { BuildURI } from "@adviser/cement";
import { VibesSwitch, VibesButton, ArrowLeftIcon, ArrowRightIcon, gridBackground, cx } from "@vibes.diy/base";
import { isMobileViewport } from "../utils/ViewState.js";
import VibeGallery from "./NewSessionContent/VibeGallery.js";
import { getSuggestionsInnerStyle, getButtonStyle } from "./NewSessionContent/carousel-styles.js";

export default function HomePage() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);

  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { sthis } = useVibesDiy();
  const navigate = useNavigate();

  // Detect mobile on mount and resize
  useEffect(() => {
    const check = () => setIsMobile(isMobileViewport());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!prompt?.trim()) return;
    navigate(
      BuildURI.from(window.location.href).pathname("/chat/prompt").setParam("prompt64", sthis.txt.base64.encode(prompt))
        .withoutHostAndSchema
    );
  }, [prompt, navigate, sthis]);

  const handleSubmit = useCallback(() => {
    if (input.trim()) {
      setPrompt(input);
    }
  }, [input]);

  const handleSelectSuggestion = useCallback((text: string) => {
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animationTimer.current) clearTimeout(animationTimer.current);
    };
  }, []);
  const [animationOffset, setAnimationOffset] = useState(0);
  const [slideDistance, setSlideDistance] = useState(0);
  const [buttonWidth, setButtonWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateDimensions = () => {
      if (viewportRef.current) {
        const viewportWidth = viewportRef.current.offsetWidth;
        if (viewportWidth > 0) {
          const gap = 20;
          const horizontalPadding = 12;
          const visibleButtons = isMobile ? 1 : 3;
          const totalGaps = isMobile ? 0 : 2;
          const calculatedButtonWidth = (viewportWidth - gap * totalGaps - horizontalPadding * 2) / visibleButtons;
          setButtonWidth(calculatedButtonWidth);
          setSlideDistance(calculatedButtonWidth + gap);
        }
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (viewportRef.current) {
      resizeObserver = new ResizeObserver(() => calculateDimensions());
      resizeObserver.observe(viewportRef.current);
    }
    calculateDimensions();
    window.addEventListener("resize", calculateDimensions);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", calculateDimensions);
    };
  }, [isMobile]);

  const handlePrevious = () => {
    if (isAnimating || !slideDistance) return;
    setIsAnimating(true);
    setAnimationOffset(slideDistance);
    animationTimer.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev === 0 ? quickSuggestions.length - 1 : prev - 1));
      setAnimationOffset(0);
      setIsAnimating(false);
    }, 400);
  };

  const handleNext = () => {
    if (isAnimating || !slideDistance) return;
    setIsAnimating(true);
    setAnimationOffset(-slideDistance);
    animationTimer.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % quickSuggestions.length);
      setAnimationOffset(0);
      setIsAnimating(false);
    }, 400);
  };

  const getSlidingWindow = () => {
    const total = quickSuggestions.length;
    if (isMobile) {
      return [
        { suggestion: quickSuggestions[(currentIndex - 1 + total) % total], originalIndex: (currentIndex - 1 + total) % total },
        { suggestion: quickSuggestions[currentIndex], originalIndex: currentIndex },
        { suggestion: quickSuggestions[(currentIndex + 1) % total], originalIndex: (currentIndex + 1) % total },
      ];
    }
    return [
      { suggestion: quickSuggestions[(currentIndex - 1 + total) % total], originalIndex: (currentIndex - 1 + total) % total },
      { suggestion: quickSuggestions[currentIndex], originalIndex: currentIndex },
      { suggestion: quickSuggestions[(currentIndex + 1) % total], originalIndex: (currentIndex + 1) % total },
      { suggestion: quickSuggestions[(currentIndex + 2) % total], originalIndex: (currentIndex + 2) % total },
      { suggestion: quickSuggestions[(currentIndex + 3) % total], originalIndex: (currentIndex + 3) % total },
    ];
  };

  const slidingWindow = getSlidingWindow();
  const baseOffset = slideDistance ? -(slideDistance + 8) : 0;
  const totalOffset = baseOffset + animationOffset;
  const buttonVariants = ["blue", "red", "yellow"] as const;

  if (isMobile === null) {
    return <div className={cx(gridBackground, "page-grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full")} />;
  }
  const mobile = isMobile as boolean;

  return (
    <>
      <div className={cx(gridBackground, "page-grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full")}>
        <div className="px-6 pb-8 pt-0 md:px-8">
          <div className="relative z-20 mb-4 ml-2 md:mb-8 md:ml-6">
            <VibesSwitch size={75} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
          </div>

          <div className={`mx-auto flex w-full max-w-3xl flex-col ${mobile ? "items-stretch gap-4" : "items-center gap-6"}`}>
            <h1
              className={`flex w-full justify-center text-center font-[Alte_Haas_Grotesk,Inter,sans-serif] text-near-black dark:text-dark-primary ${mobile ? "px-2 text-2xl" : "text-[65px]"}`}
            >
              What&apos;s the&nbsp;
              <span className="underline">vibe</span>? Try it.
            </h1>

            {/* Chat input form */}
            <div
              className={`relative box-border min-h-[200px] rounded-lg border-2 border-near-black bg-light-background-00 dark:border-dark-primary dark:bg-dark-background-00 ${mobile ? "flex w-full flex-col" : "flex max-w-lg flex-row"}`}
            >
              <div
                className={`flex items-center justify-center text-near-black dark:text-dark-primary ${
                  mobile
                    ? "rounded-t-lg border-b-2 border-near-black px-3 py-2 text-2xl dark:border-dark-primary"
                    : "rounded-br-lg rounded-tr-lg border-l-2 border-near-black px-2 py-5 text-4xl dark:border-dark-primary [writing-mode:vertical-rl] [transform:rotate(180deg)]"
                }`}
              >
                Prompt
              </div>
              <div className="relative flex flex-1 flex-col">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Describe your vibe to make it an app."
                  className="flex-1 resize-none border-none bg-transparent p-6 pr-20 font-inherit text-lg text-near-black outline-none dark:text-dark-primary"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className="absolute bottom-5 right-5 flex h-[45px] w-[45px] cursor-pointer items-center justify-center rounded-full border-none bg-near-black text-2xl font-bold text-white transition-transform duration-200 ease-in-out dark:bg-dark-primary dark:text-dark-background-00"
                >
                  ↑
                </button>
              </div>
            </div>

            {/* Carousel */}
            <div className={`flex w-full items-center ${mobile ? "gap-2 px-4" : "gap-3"}`}>
              <button
                className="flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-near-black transition-all duration-200 ease-in-out dark:text-dark-primary"
                style={{ width: mobile ? 32 : 40, height: mobile ? 32 : 40 }}
                onClick={handlePrevious}
                aria-label="Previous suggestions"
              >
                <ArrowLeftIcon width={mobile ? 20 : 24} height={mobile ? 20 : 24} fill="currentColor" />
              </button>

              <div ref={viewportRef} className="relative flex min-w-0 flex-1 overflow-hidden px-3 pb-4 pt-2">
                <div ref={containerRef} style={getSuggestionsInnerStyle(totalOffset, isAnimating)}>
                  {slidingWindow.map(({ suggestion, originalIndex }, index) => (
                    <VibesButton
                      key={`${suggestion.label}-${currentIndex}-${index}`}
                      variant={buttonVariants[originalIndex % 3]}
                      style={{ ...getButtonStyle(), width: buttonWidth > 0 ? `${buttonWidth}px` : "33.333%" }}
                      onClick={() => handleSelectSuggestion(suggestion.text)}
                    >
                      {suggestion.label}
                    </VibesButton>
                  ))}
                </div>
              </div>

              <button
                className="flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-near-black transition-all duration-200 ease-in-out dark:text-dark-primary"
                style={{ width: mobile ? 32 : 40, height: mobile ? 32 : 40 }}
                onClick={handleNext}
                aria-label="Next suggestions"
              >
                <ArrowRightIcon width={mobile ? 20 : 24} height={mobile ? 20 : 24} fill="currentColor" />
              </button>
            </div>

            {/* Gallery */}
            <div
              className={`box-border overflow-hidden rounded-lg border-2 border-near-black bg-light-decorative-01 dark:border-dark-primary dark:bg-dark-decorative-01 ${mobile ? "flex w-full flex-col" : "flex max-w-lg flex-row"}`}
            >
              <div
                className={`flex items-center justify-center text-near-black dark:text-dark-primary ${
                  mobile
                    ? "rounded-t-lg border-b-2 border-near-black px-3 py-2 text-2xl dark:border-dark-primary"
                    : "rounded-br-lg rounded-tr-lg border-l-2 border-near-black px-2 py-5 text-4xl dark:border-dark-primary [writing-mode:vertical-rl] [transform:rotate(180deg)]"
                }`}
              >
                Gallery
              </div>
              <div className="flex flex-1 flex-col">
                <VibeGallery count={4} isMobile={mobile} onSelectPrompt={handleSelectSuggestion} />
                <p className="border-t-2 border-near-black px-6 py-1 text-left text-xl font-medium text-near-black dark:border-dark-primary dark:text-dark-primary">
                  The vibes are strong with these four top picks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
    </>
  );
}

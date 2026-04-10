import React, { useCallback, useEffect, useRef, useState } from "react";
import SessionSidebar from "./SessionSidebar.js";
import { quickSuggestions } from "../data/quick-suggestions-data.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { useNavigate } from "react-router";
import { BuildURI } from "@adviser/cement";
import { VibesSwitch, VibesButton, ArrowLeftIcon, ArrowRightIcon, gridBackground, cx } from "@vibes.diy/base";
import { useIsMobile } from "../hooks/useIsMobile.js";
import VibeGallery from "./NewSessionContent/VibeGallery.js";
import {
  getContainerStyle,
  getCarouselWrapperStyle,
  getCarouselNavButtonStyle,
  getSuggestionsContainerStyle,
  getSuggestionsInnerStyle,
  getButtonStyle,
  getChatInputContainerStyle,
  getChatInputLabelStyle,
  getTextareaWrapperStyle,
  getTextareaStyle,
  getSubmitButtonStyle,
  getGalleryContainerStyle,
  getGalleryLabelStyle,
  getGalleryContentStyle,
  getGalleryDescriptionStyle,
  getTitle,
} from "./NewSessionContent/NewSessionContent.styles.js";

export default function HomePage() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);

  const isMobile = useIsMobile();
  const [input, setInput] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { sthis } = useVibesDiy();
  const navigate = useNavigate();

  useEffect(() => {
    if (!prompt?.trim()) return;
    navigate(
      BuildURI.from(window.location.href).pathname("/chat/prompt").setParam("prompt64", sthis.txt.base64.encode(prompt))
        .withoutHostAndSchema
    );
  }, [prompt]);

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
        <div className="px-4 md:px-8 pb-8 pt-0">
          <div className="mb-4 md:mb-8 ml-2 md:ml-6 relative z-20">
            <VibesSwitch size={75} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
          </div>

          <div style={getContainerStyle(mobile)}>
            <h1 style={getTitle(mobile)}>
              What's the&nbsp;
              <span style={{ textDecoration: "underline" }}>vibe</span>? Try it.
            </h1>

            {/* Chat input form */}
            <div style={getChatInputContainerStyle(mobile)}>
              <div style={getChatInputLabelStyle(mobile)}>Prompt</div>
              <div style={getTextareaWrapperStyle()}>
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
                  style={getTextareaStyle()}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  style={getSubmitButtonStyle()}
                >
                  ↑
                </button>
              </div>
            </div>

            {/* Carousel */}
            <div style={getCarouselWrapperStyle(mobile)}>
              <button style={getCarouselNavButtonStyle(mobile)} onClick={handlePrevious} aria-label="Previous suggestions">
                <ArrowLeftIcon width={mobile ? 20 : 24} height={mobile ? 20 : 24} fill="var(--vibes-near-black)" />
              </button>

              <div ref={viewportRef} style={getSuggestionsContainerStyle()}>
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

              <button style={getCarouselNavButtonStyle(mobile)} onClick={handleNext} aria-label="Next suggestions">
                <ArrowRightIcon width={mobile ? 20 : 24} height={mobile ? 20 : 24} fill="var(--vibes-near-black)" />
              </button>
            </div>

            {/* Gallery */}
            <div style={getGalleryContainerStyle(mobile)}>
              <div style={getGalleryLabelStyle(mobile)}>Gallery</div>
              <div style={getGalleryContentStyle()}>
                <VibeGallery count={4} isMobile={mobile} onSelectPrompt={handleSelectSuggestion} />
                <p style={getGalleryDescriptionStyle()}>
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

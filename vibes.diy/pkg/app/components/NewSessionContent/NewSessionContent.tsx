import React, { useState, useEffect } from "react";
import { VibesButton } from "../vibes/VibesButton/index.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "../vibes/icons/index.js";
import type { NewSessionChatState } from "@vibes.diy/prompts";
import { quickSuggestions } from "../../data/quick-suggestions-data.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import VibeGallery from "./VibeGallery.js";
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
} from "./NewSessionContent.styles.js";

interface NewSessionContentProps {
  chatState: NewSessionChatState;
  handleSelectSuggestion: (suggestion: string) => void;
}

export default function NewSessionContent({
  chatState,
  handleSelectSuggestion,
}: NewSessionContentProps) {
  const isMobile = useIsMobile();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationOffset, setAnimationOffset] = useState(0);
  const [slideDistance, setSlideDistance] = useState(0);
  const [buttonWidth, setButtonWidth] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Calculate button width based on mobile/desktop: 1 button on mobile, 3 on desktop
  useEffect(() => {
    const calculateDimensions = () => {
      if (viewportRef.current) {
        const viewportWidth = viewportRef.current.offsetWidth;
        // Only calculate if we have a valid width
        if (viewportWidth > 0) {
          const gap = 20; // Increased gap to accommodate box-shadow
          const horizontalPadding = 12; // Padding to accommodate box-shadow and prevent edge clipping
          const visibleButtons = isMobile ? 1 : 3;
          const totalGaps = isMobile ? 0 : 2; // 1 button = 0 gaps, 3 buttons = 2 gaps
          // Calculate button width
          const calculatedButtonWidth =
            (viewportWidth - gap * totalGaps - horizontalPadding * 2) /
            visibleButtons;
          setButtonWidth(calculatedButtonWidth);
          setSlideDistance(calculatedButtonWidth + gap);
        }
      }
    };

    // Use ResizeObserver to detect when viewport gets its dimensions
    let resizeObserver: ResizeObserver | null = null;

    if (viewportRef.current) {
      resizeObserver = new ResizeObserver(() => {
        calculateDimensions();
      });
      resizeObserver.observe(viewportRef.current);
    }

    // Also calculate immediately in case dimensions are already available
    calculateDimensions();

    // Fallback: also listen to window resize for viewport size changes
    window.addEventListener("resize", calculateDimensions);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", calculateDimensions);
    };
  }, [isMobile]);

  // Navigation handlers for infinite carousel
  const handlePrevious = () => {
    if (isAnimating || !slideDistance) return;

    setIsAnimating(true);
    setAnimationOffset(slideDistance); // Slide right to reveal left button

    // After animation, update index and reset offset
    setTimeout(() => {
      setCurrentIndex((prev) =>
        prev === 0 ? quickSuggestions.length - 1 : prev - 1,
      );
      setAnimationOffset(0);
      setIsAnimating(false);
    }, 400); // Match transition duration
  };

  const handleNext = () => {
    if (isAnimating || !slideDistance) return;

    setIsAnimating(true);
    setAnimationOffset(-slideDistance); // Slide left to reveal right button

    // After animation, update index and reset offset
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % quickSuggestions.length);
      setAnimationOffset(0);
      setIsAnimating(false);
    }, 400); // Match transition duration
  };

  // Get suggestions for sliding window with their original indices
  // Mobile: [hidden left] [visible 1] [hidden right]
  // Desktop: [hidden left] [visible 1] [visible 2] [visible 3] [hidden right]
  const getSlidingWindow = () => {
    const totalSuggestions = quickSuggestions.length;

    if (isMobile) {
      return [
        {
          suggestion:
            quickSuggestions[
              (currentIndex - 1 + totalSuggestions) % totalSuggestions
            ], // hidden left
          originalIndex:
            (currentIndex - 1 + totalSuggestions) % totalSuggestions,
        },
        {
          suggestion: quickSuggestions[currentIndex], // visible 1
          originalIndex: currentIndex,
        },
        {
          suggestion: quickSuggestions[(currentIndex + 1) % totalSuggestions], // hidden right
          originalIndex: (currentIndex + 1) % totalSuggestions,
        },
      ];
    }

    // Desktop: 5 items
    return [
      {
        suggestion:
          quickSuggestions[
            (currentIndex - 1 + totalSuggestions) % totalSuggestions
          ], // hidden left
        originalIndex: (currentIndex - 1 + totalSuggestions) % totalSuggestions,
      },
      {
        suggestion: quickSuggestions[currentIndex], // visible 1
        originalIndex: currentIndex,
      },
      {
        suggestion: quickSuggestions[(currentIndex + 1) % totalSuggestions], // visible 2
        originalIndex: (currentIndex + 1) % totalSuggestions,
      },
      {
        suggestion: quickSuggestions[(currentIndex + 2) % totalSuggestions], // visible 3
        originalIndex: (currentIndex + 2) % totalSuggestions,
      },
      {
        suggestion: quickSuggestions[(currentIndex + 3) % totalSuggestions], // hidden right
        originalIndex: (currentIndex + 3) % totalSuggestions,
      },
    ];
  };

  const slidingWindow = getSlidingWindow();

  // Calculate base offset to hide the first button (position strip so index 1 is at start)
  // Add extra 8px to account for box-shadow and border
  const baseOffset = slideDistance ? -(slideDistance + 8) : 0;

  // Total offset = base offset (to hide first button) + animation offset
  const totalOffset = baseOffset + animationOffset;

  // Button color variants - cycle through colors based on original position
  const buttonVariants = ["blue", "red", "yellow"] as const;

  return (
    <div style={getContainerStyle(isMobile)}>
      <h1 style={getTitle(isMobile)}>
        What's the&nbsp;
        <span style={{ textDecoration: "underline" }}>vibe</span>? Try it.
      </h1>

      {/* Chat input form */}
      <div style={getChatInputContainerStyle(isMobile)}>
        <div style={getChatInputLabelStyle(isMobile)}>Prompt</div>
        <div style={getTextareaWrapperStyle()}>
          <textarea
            ref={chatState.inputRef}
            value={chatState.input}
            onChange={(e) => chatState.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !chatState.isStreaming) {
                e.preventDefault();
                if (chatState.sendMessage) {
                  chatState.sendMessage(chatState.input);
                }
              }
            }}
            placeholder="Describe your vibe to make it an app."
            style={getTextareaStyle()}
          />
          <button
            onClick={() => {
              if (chatState.sendMessage && !chatState.isStreaming) {
                chatState.sendMessage(chatState.input);
              }
            }}
            disabled={chatState.isStreaming || !chatState.input.trim()}
            style={getSubmitButtonStyle()}
          >
            ↑
          </button>
        </div>
      </div>

      {/* Carousel with navigation */}
      <div style={getCarouselWrapperStyle(isMobile)}>
        <button
          style={getCarouselNavButtonStyle(isMobile)}
          onClick={handlePrevious}
          aria-label="Previous suggestions"
        >
          <ArrowRightIcon
            width={isMobile ? 20 : 24}
            height={isMobile ? 20 : 24}
            fill="var(--vibes-near-black)"
          />
        </button>

        <div ref={viewportRef} style={getSuggestionsContainerStyle()}>
          <div
            ref={containerRef}
            style={getSuggestionsInnerStyle(totalOffset, isAnimating)}
          >
            {slidingWindow.map(({ suggestion, originalIndex }, index) => {
              // Assign color based on original position in quickSuggestions array
              const variant = buttonVariants[originalIndex % 3];

              return (
                <VibesButton
                  key={`${suggestion.label}-${currentIndex}-${index}`}
                  variant={variant}
                  style={{
                    ...getButtonStyle(),
                    width: buttonWidth > 0 ? `${buttonWidth}px` : "33.333%",
                  }}
                  onClick={() => handleSelectSuggestion(suggestion.text)}
                >
                  {suggestion.label}
                </VibesButton>
              );
            })}
          </div>
        </div>

        <button
          style={getCarouselNavButtonStyle(isMobile)}
          onClick={handleNext}
          aria-label="Next suggestions"
        >
          <ArrowLeftIcon
            width={isMobile ? 20 : 24}
            height={isMobile ? 20 : 24}
            fill="var(--vibes-near-black)"
          />
        </button>
      </div>

      {/* Featured vibes section */}
      <div style={getGalleryContainerStyle(isMobile)}>
        <div style={getGalleryLabelStyle(isMobile)}>Gallery</div>
        <div style={getGalleryContentStyle()}>
          <VibeGallery count={4} isMobile={isMobile} />
          <p style={getGalleryDescriptionStyle()}>
            The vibes are strong with these four top picks.
          </p>
        </div>
      </div>
    </div>
  );
}

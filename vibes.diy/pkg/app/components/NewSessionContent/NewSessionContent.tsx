import React, { useState, useEffect } from "react";
import { VibesButton, ArrowLeftIcon, ArrowRightIcon } from "@vibes.diy/use-vibes-base";
import type { NewSessionChatState } from "@vibes.diy/prompts";
import { quickSuggestions } from "../../data/quick-suggestions-data.js";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationOffset, setAnimationOffset] = useState(0);
  const [slideDistance, setSlideDistance] = useState(0);
  const [buttonWidth, setButtonWidth] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Calculate button width so that exactly 3 buttons fill the container
  useEffect(() => {
    const calculateDimensions = () => {
      if (viewportRef.current) {
        const viewportWidth = viewportRef.current.offsetWidth;
        const gap = 20; // Increased gap to accommodate box-shadow
        const horizontalPadding = 12; // Padding to accommodate box-shadow and prevent edge clipping
        // Calculate button width: (container width - 2 gaps - 2 * horizontal padding) / 3
        const calculatedButtonWidth = (viewportWidth - gap * 2 - horizontalPadding * 2) / 3;
        setButtonWidth(calculatedButtonWidth);
        setSlideDistance(calculatedButtonWidth + gap);
      }
    };

    // Small delay to ensure container is rendered
    const timer = setTimeout(calculateDimensions, 50);

    // Recalculate on window resize
    window.addEventListener("resize", calculateDimensions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculateDimensions);
    };
  }, []);

  // Recalculate when dimensions might change
  useEffect(() => {
    if (viewportRef.current && buttonWidth === 0) {
      const viewportWidth = viewportRef.current.offsetWidth;
      const gap = 20; // Increased gap to accommodate box-shadow
      const horizontalPadding = 12; // Padding to accommodate box-shadow and prevent edge clipping
      const calculatedButtonWidth = (viewportWidth - gap * 2 - horizontalPadding * 2) / 3;
      setButtonWidth(calculatedButtonWidth);
      setSlideDistance(calculatedButtonWidth + gap);
    }
  }, [buttonWidth]);

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

  // Get 5 suggestions for sliding window with their original indices
  // [hidden left] [visible 1] [visible 2] [visible 3] [hidden right]
  const getSlidingWindow = () => {
    const totalSuggestions = quickSuggestions.length;
    return [
      {
        suggestion: quickSuggestions[
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
    <div style={getContainerStyle()}>
      <h1 style={getTitle()}>What's the&nbsp;<span style={{textDecoration: 'underline'}}>vibe</span>? Try it.</h1>

      {/* Chat input form */}
      <div style={getChatInputContainerStyle()}>
        <div style={getChatInputLabelStyle()}>Prompt</div>
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
      <div style={getCarouselWrapperStyle()}>
        <button
          style={getCarouselNavButtonStyle()}
          onClick={handlePrevious}
          aria-label="Previous suggestions"
        >
          <ArrowRightIcon width={24} height={24} fill="var(--vibes-near-black)" />
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
          style={getCarouselNavButtonStyle()}
          onClick={handleNext}
          aria-label="Next suggestions"
        >
          <ArrowLeftIcon width={24} height={24} fill="var(--vibes-near-black)" />
        </button>
      </div>

      {/* Featured vibes section */}
      <div style={getGalleryContainerStyle()}>
        <div style={getGalleryLabelStyle()}>Gallery</div>
        <div style={getGalleryContentStyle()}>
          <VibeGallery count={4} />
          <p style={getGalleryDescriptionStyle()}>
            The vibes are strong with these four top picks.
          </p>
        </div>
      </div>
    </div>
  );
}

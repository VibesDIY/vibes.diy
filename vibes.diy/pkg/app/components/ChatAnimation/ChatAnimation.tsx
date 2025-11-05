import React, { useEffect, useRef, useState } from "react";
import type { ChatAnimationProps } from "./ChatAnimation.types.js";
import {
  getChatContainerStyle,
  getMessageWrapperStyle,
  getMessageBubbleStyle,
  getUsernameStyle,
  getScrollIndicatorStyle,
  getScrollTextStyle,
  getArrowStyle,
  getArrowInnerStyle,
  getTitleStyle,
} from "./ChatAnimation.styles.js";

export const ChatAnimation: React.FC<ChatAnimationProps> = ({
  arrayOfMessages,
  user,
  title,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  // Scroll tracking to toggle the scroll indicator
  useEffect(() => {
    const container = chatContainerRef.current;

    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight,
        ) < 5;

      setShowScrollIndicator(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    // Trigger on mount in case we're already at bottom
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Inject animations into document
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes slide-in-left {
        from {
          opacity: 0;
          transform: translateX(-100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slide-in-right {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-15px);
        }
      }

      .message-current-user, .message-other-user {
        animation: linear both;
        animation-timeline: view();
        animation-range: entry 0% cover 30%;
      }

      .message-current-user {
        animation-name: slide-in-right;
      }

      .message-other-user {
        animation-name: slide-in-left;
      }

      .scroll-indicator {
        animation: bounce 1.5s ease-in-out infinite;
      }

      .chat-container-wrapper::-webkit-scrollbar {
        display: none;
      }

      .last-message-wrapper {
        scroll-margin-bottom: 0;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div
      className="chat-container-wrapper"
      style={getChatContainerStyle()}
      ref={chatContainerRef}
    >
      {title && <div style={getTitleStyle()}>{title}</div>}
      {arrayOfMessages.map((msg, index) => {
        const isCurrentUser = msg.user === user;
        const isLastMessage = index === arrayOfMessages.length - 1;
        const className = isCurrentUser
          ? "message-current-user"
          : "message-other-user";
        const wrapperClass = isLastMessage
          ? `${className} last-message-wrapper`
          : className;

        return (
          <div
            key={index}
            className={wrapperClass}
            style={getMessageWrapperStyle(isCurrentUser)}
          >
            <div style={{ width: "100%" }}>
              <div style={getUsernameStyle(isCurrentUser)}>{msg.user}</div>
              <div style={getMessageBubbleStyle(isCurrentUser)}>
                {msg.message}
              </div>
            </div>
          </div>
        );
      })}

      {showScrollIndicator && (
        <div className="scroll-indicator" style={getScrollIndicatorStyle()}>
          <div style={getScrollTextStyle()}>Scroll to Read More</div>
          <div style={getArrowStyle()}>
            <div style={getArrowInnerStyle()} />
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { HiddenMenuWrapper } from "../components/vibes/HiddenMenuWrapper/HiddenMenuWrapper.js";
import { VibesPanel } from "../components/vibes/VibesPanel.js";
import { LabelContainer } from "../components/vibes/LabelContainer/index.js";
import { useMobile } from "@vibes.diy/use-vibes-base";
import {
  getButtonStyle,
  getMergedButtonStyle,
  getIconContainerStyle,
  getIconStyle,
  getContentWrapperStyle as getButtonContentWrapperStyle,
} from "../components/vibes/VibesButton/VibesButton.styles.js";
import { LoginIcon } from "../components/vibes/icons/LoginIcon.js";
import {
  getContainerStyle,
  getContentWrapperStyle,
  getLoginLayoutStyle,
  getTextContainerStyle,
  getTitleStyle,
  getCursorStyle,
  getMessageStyle,
  getBlinkKeyframes,
} from "./test-menu.styles.js";

export default function TestMenu() {
  const navigate = useNavigate();
  const [displayedText, setDisplayedText] = useState("");
  const isMobile = useMobile();
  const fullText = "Welcome to Vibes";

  useEffect(() => {
    let currentIndex = 0;
    const typingSpeed = 100;

    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, typingSpeed);

    return () => clearInterval(typingInterval);
  }, []);

  useEffect(() => {
    const styleId = "test-menu-blink-keyframes";
    const existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = getBlinkKeyframes();
      document.head.appendChild(style);
    }

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  const handleLoginClick = () => {
    navigate("/auth");
  };

  return (
    <HiddenMenuWrapper menuContent={<VibesPanel />}>
      <div style={getContainerStyle()}>
        <div style={getContentWrapperStyle()}>
          <LabelContainer label="Login">
            <div style={getLoginLayoutStyle()}>
              <div
                style={{
                  ...getMergedButtonStyle(
                    getButtonStyle("blue", false, false, isMobile, true, "square"),
                    false,
                    { cursor: "pointer" },
                    "square",
                  ),
                }}
                onClick={handleLoginClick}
              >
                <div style={getButtonContentWrapperStyle(isMobile, true, "square")}>
                  <div
                    style={getIconContainerStyle("blue", isMobile, true, "square")}
                  >
                    <div style={getIconStyle(isMobile, false, false)}>
                      <LoginIcon
                        bgFill="var(--vibes-button-icon-bg)"
                        fill="var(--vibes-button-icon-fill)"
                        width={isMobile ? 28 : 50}
                        height={isMobile ? 28 : 50}
                      />
                    </div>
                  </div>
                  <span>LOGIN</span>
                </div>
              </div>
              <div style={getTextContainerStyle()}>
                <h1 style={getTitleStyle()}>
                  {displayedText}
                  <span style={getCursorStyle()} />
                </h1>
                <p style={getMessageStyle()}>Click to continue</p>
              </div>
            </div>
          </LabelContainer>
        </div>
      </div>
    </HiddenMenuWrapper>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { SideMenu } from "./SideMenu.js";
import { TerminalDemo } from "./TerminalDemo.js";
import {
  getContainerStyle,
  getWrapperStyle,
  getBackgroundStyle,
  getScrollingBackgroundsStyle,
  getMenuStyle,
  getInnerContainerStyle,
  getSectionsContainerStyle,
  getSectionWrapperStyle,
  getBlackBorderWrapper,
  getBlackBorderInnerWrapper,
  getUsernameStyle,
  getMessageBubbleStyle,
  getTitleStyle,
  getMessageWrapperStyle,
  getChatContainerStyle,
  getChatContainerStyleOut,
  getChatContainerTopBar,
  getChatContainerBottomCard,
  getSection0BackgroundStyle,
  getSection1BackgroundStyle,
  getSection3BackgroundStyle,
  getSection5BackgroundStyle,
  getSection8BackgroundStyle,
  getLinkStyle,
  getSecondCardStyle,
  getHeroHeadingStyle,
  getHeroSubheadingStyle,
  getCardTextStyle,
  getComputerAnimContainerStyle,
  getFullSizeImageStyle,
  getMessageContentWrapperStyle,
  getSectionHeadingStyle,
  getContentWrapperStyle,
  getSubheadingBoldStyle,
  getImageCardStyle,
  getImageCardStyleSmall,
  getSectionWithAnimatedSceneStyle,
  getAnimatedSectionTextColumnStyle,
  getAnimatedSceneDesktopPlaceholderStyle,
  getScrollableAnimatedSceneMobileContainerStyle,
  getScrollableAnimatedSceneWrapperStyle,
  getScrollableAnimatedSceneInnerStyle,
  getStickyAnimatedSceneMobileStyle,
  getStickyAnimatedSceneDesktopStyle,
  getStickyAnimatedSceneDesktopLeftSpacerStyle,
  getStickyAnimatedSceneDesktopRightContainerStyle,
  getButtonsWrapper,
  getButtonsNavbar,
  getNavbarButtonIconWrapper,
  getNavbarButtonLabel,
  getLinkOutStyle,
  get1of3Column,
  get2of3Column,
  getHiddenScrollDivStyle,
  getHiddenScrollDivInnerStyle,
} from "./HomeScreen.styles.js";
import {
  ChatAnimation,
  DraggableCard,
  DraggableSection,
  VibesSwitch,
} from "../../components/index.js";
import { HomeScreenProps } from "./HomeScreen.types.js";
import { useIsMobile, usePrefersDarkMode } from "../../hooks/index.js";
import { AnimatedScene } from "./AnimatedScene.js";
import { MoonIcon, SunIcon } from "../../components/vibes/icons/index.js";

// Asset paths (referenced as strings for non-bundled builds)
const computerAnimGif = "/app/assets/computer-anim.gif";
const htmlpng = "/app/assets/html.png";
const mouth = "/app/assets/mouth.gif";
const rainbowComputer = "/app/assets/rainbow-computer.gif";
const fireproofLogo = "/app/assets/fireproof-logo.png";
const vibeZoneChart = "/app/assets/vibe-zone.png";

// Helper function to convert URLs in text to clickable links
const renderMessageWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={getLinkStyle()}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export const HomeScreen = (_props: HomeScreenProps) => {
  const isMobile = useIsMobile();
  const browserPrefersDark = usePrefersDarkMode();
  const clerk = useClerk();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneSection0Ref = useRef<HTMLDivElement>(null);
  const animatedSceneSection0MobileRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainer0MobileRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hiddenScrollDivRef = useRef<HTMLDivElement>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Dark mode state - initialize from localStorage or browser preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("vibes-dark-mode");
    if (stored !== null) {
      return stored === "true";
    }
    return browserPrefersDark;
  });

  // Dark mode toggle handler
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("vibes-dark-mode", String(newValue));
      return newValue;
    });
  };

  // Shared login function used by both navbar and side menu
  const handleLogin = async () => {
    await clerk.redirectToSignIn({
      redirectUrl: window.location.href,
    });
  };

  // Apply dark mode to document root
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [isDarkMode]);

  // References for the sections to calculate dynamic backgrounds
  const section0Ref = useRef<HTMLDivElement>(null);
  const section1Ref = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);
  const section5Ref = useRef<HTMLDivElement>(null);
  const section8Ref = useRef<HTMLDivElement>(null);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);

  // State to trigger re-render after refs are mounted
  const [refsReady, setRefsReady] = useState(false);
  const [recalcCounter, setRecalcCounter] = useState(0);

  // 🧩 Define your 3 chat scenarios
  const scenarios = [
    {
      title: `JChris named the conversation "Friendsgiving 2: Mac n Cheese Redemption"`,
      arrayOfMessages: [
        { user: "JChris", message: "Who’s coming to Friendsgiving this year?" },
        { user: "Megan", message: "yes please rescue me from my family 🥲" },
        {
          user: "JChris",
          message: "can we not repeat last year’s mac n cheese disaster tho",
        },
        { user: "Megan", message: "I’m still recovering!" },
        { user: "Mike", message: "Should I make a spreadsheet?" },
        { user: "Megan", message: "Zzzzzzzzz" },
        { user: "You", message: "buds I got this!" },
        { user: "You", message: "lemme just make us a festive lil app:" },
        { user: "You", message: "https://bright-shango-4087.vibesdiy.app/" },
        { user: "JChris", message: "nice! dibs on the mac" },
        {
          user: "Marcus",
          message: "I’m a *coder* now\n*tries Vibes DIY once* 🤓",
        },
      ],
    },
    {
      title: `Roomies`,
      arrayOfMessages: [
        {
          user: "James",
          message:
            "sorry roomies, I didn’t have time to tackle Dish Mountain last night",
        },
        { user: "James", message: "will absolutely get to it after work" },
        { user: "Lola", message: "Pretty sure it’s my turn, no?" },
        { user: "Jordan", message: "Huge if true!!" },
        {
          user: "James",
          message:
            "@Lola if you do the dishes I’ll take out the trash tomorrow AM!",
        },
        { user: "You", message: "ok hear me out:" },
        { user: "You", message: "chore chart, but make it fun?" },
        { user: "You", message: "https://coltrane-oshun-9477.vibesdiy.app/" },
        { user: "Jordan", message: "Did we just…solve dishes?" },
        { user: "James", message: "Chore quest!!!" },
      ],
    },
    {
      title: `Trivia Night`,
      arrayOfMessages: [
        { user: "Bobby", message: "never felt dumber than last night 🥲" },
        {
          user: "Bobby",
          message: "they should make trivia night for people with brainrot",
        },
        {
          user: "You",
          message: "“I’ll take Real Housewives of SLC for $500, Alex!”",
        },
        { user: "Lindsay", message: "Bravo Brainteasters lol" },
        {
          user: "Nikki",
          message: "to be fair, the reality TV lore is deeeeeep",
        },
        { user: "Lindsay", message: "actually I’d probably watch that" },
        { user: "Bobby", message: "imagine Andy Cohen as a host" },
        {
          user: "You",
          message:
            "I kinda think you might have something with this:\nhttps://chromatic-fader-4248.vibesdiy.app/",
        },
        { user: "Bobby", message: "oh it’s so over for all of you!!!!" },
      ],
    },
  ];

  // 🎲 Pick one scenario at random on each render
  const selectedScenario = useMemo(
    () => scenarios[Math.floor(Math.random() * scenarios.length)],
    [], // empty deps = pick once per mount
  );

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

        @keyframes wiggle {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-5deg);
          }
          75% {
            transform: rotate(5deg);
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-3px);
          }
          75% {
            transform: translateX(3px);
          }
        }

        @keyframes staticNoise {
          0%, 100% { background-position: 0 0; }
          10% { background-position: -5% -5%; }
          20% { background-position: -10% 5%; }
          30% { background-position: 5% -10%; }
          40% { background-position: -5% 15%; }
          50% { background-position: -10% 5%; }
          60% { background-position: 15% 0; }
          70% { background-position: 0 10%; }
          80% { background-position: -15% 0; }
          90% { background-position: 10% 5%; }
        }

        .navbar-button-wrapper button {
          width: 64px;
          justify-content: center;
        }

        .navbar-button-wrapper .navbar-button-label {
          width: 0;
          padding: 0;
        }

        .navbar-button-wrapper:hover button {
          width: 200px !important;
          justify-content: flex-start !important;
        }

        .navbar-button-wrapper:hover .navbar-button-label {
          opacity: 1 !important;
          width: auto !important;
          max-width: 150px !important;
          padding: 0 16px 0 8px !important;
        }

        .navbar-button-wrapper:hover .navbar-button-icon {
          animation: wiggle 0.6s ease-in-out infinite;
        }

        button:active {
          animation: shake 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideInItem {
          from {
            opacity: 0;
            transform: translateX(50px) rotate(2deg);
          }
          to {
            opacity: 1;
            transform: translateX(0) rotate(0deg);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes slideOutRight {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }

        @keyframes slideOutItem {
          from {
            opacity: 1;
            transform: translateX(0) rotate(0deg);
          }
          to {
            opacity: 0;
            transform: translateX(50px) rotate(-2deg);
          }
        }

        .side-menu-item:hover {
          transform: translateX(-8px);
          box-shadow: 10px 10px 0px #231F20 !important;
        }

        .side-menu-item:active {
          transform: translateX(-4px);
          box-shadow: 6px 6px 0px #231F20 !important;
        }

        button[style*="getSideMenuLoginButton"]:hover {
          transform: scale(1.02);
          box-shadow: 8px 8px 0px #231F20 !important;
        }

        button[style*="getSideMenuLoginButton"]:active {
          transform: scale(0.98);
          box-shadow: 4px 4px 0px #231F20 !important;
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

        .chat-inner::-webkit-scrollbar {
          display: none;
        }

        .animated-scene-wrapper::-webkit-scrollbar {
          display: none;
        }
      `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Force re-render after refs are mounted to calculate background positions
  useEffect(() => {
    if (
      section0Ref.current &&
      section1Ref.current &&
      section3Ref.current &&
      section5Ref.current &&
      section8Ref.current &&
      sectionsContainerRef.current
    ) {
      setRefsReady(true);
    }
  }, []);

  // Recalculate background positions only on window resize
  useEffect(() => {
    let resizeTimeout: number;

    const handleRecalculate = () => {
      // Debounce resize events to avoid recalculations during active resize
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        // Increment counter to force recalculation only once after resize stops
        setRecalcCounter((prev) => prev + 1);
      }, 300); // Wait 300ms after resize stops to ensure user finished resizing
    };

    window.addEventListener("resize", handleRecalculate);

    return () => {
      window.removeEventListener("resize", handleRecalculate);
      clearTimeout(resizeTimeout);
    };
  }, []);

  useEffect(() => {
    if (isMobile) return; // No ejecutar en móvil

    const innerContainer = innerContainerRef.current;
    const chatContainer = chatContainerRef.current;
    const animatedContainer = animatedSceneContainerRef.current;
    const animatedSection0Container = animatedSceneSection0Ref.current;
    if (!innerContainer || !chatContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if the scroll event is happening inside the Section 0 animated scene container
      const isInsideSection0AnimatedScene =
        animatedSection0Container &&
        animatedSection0Container.contains(e.target as Node);

      // Check if the scroll event is happening inside the animated scene container
      const isInsideAnimatedScene =
        animatedContainer && animatedContainer.contains(e.target as Node);

      // For Section 0, let them scroll naturally - the scroll event listener will handle progress updates
      if (isInsideSection0AnimatedScene) {
        // Don't prevent default, let the native scroll happen
        return;
      } else if (isInsideAnimatedScene && animatedContainer) {
        // Handle animated scene scrolling
        const { scrollTop, scrollHeight, clientHeight } = animatedContainer;
        const isScrollable = scrollHeight > clientHeight;
        const isAtTop = scrollTop <= 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        if (isScrollable) {
          if (e.deltaY > 0 && !isAtBottom) {
            e.preventDefault();
            animatedContainer.scrollTop += e.deltaY;

            // Update progress immediately
            const newScrollTop = animatedContainer.scrollTop;
            const scrollProgress =
              scrollHeight > clientHeight
                ? (newScrollTop / (scrollHeight - clientHeight)) * 100
                : 0;
            setAnimationProgress(Math.max(0, Math.min(100, scrollProgress)));
            return;
          }

          if (e.deltaY < 0 && !isAtTop) {
            e.preventDefault();
            animatedContainer.scrollTop += e.deltaY;

            // Update progress immediately
            const newScrollTop = animatedContainer.scrollTop;
            const scrollProgress =
              scrollHeight > clientHeight
                ? (newScrollTop / (scrollHeight - clientHeight)) * 100
                : 0;
            setAnimationProgress(Math.max(0, Math.min(100, scrollProgress)));
            return;
          }
        }
      } else if (chatContainer) {
        // Handle chat scrolling
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const isScrollable = scrollHeight > clientHeight;
        const isAtTop = scrollTop <= 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        if (isScrollable) {
          if (e.deltaY > 0 && !isAtBottom) {
            e.preventDefault();
            chatContainer.scrollTop += e.deltaY;
            return;
          }

          if (e.deltaY < 0 && !isAtTop) {
            e.preventDefault();
            chatContainer.scrollTop += e.deltaY;
            return;
          }
        }
      }

      // Si el chat ya llegó al final o principio, dejamos que el scroll continúe naturalmente
    };

    // Escuchar el evento de rueda desde *cualquier parte del innerContainer*
    innerContainer.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      innerContainer.removeEventListener("wheel", handleWheel);
    };
  }, [isMobile]);

  // Desktop: Direct scroll listener for Section 0 AnimatedScene (0-100)
  useEffect(() => {
    if (isMobile) return; // Only run on desktop

    const animatedSection0Container = animatedSceneSection0Ref.current;
    if (!animatedSection0Container) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        animatedSection0Container;
      const scrollProgress =
        scrollHeight > clientHeight
          ? (scrollTop / (scrollHeight - clientHeight)) * 100
          : 0;
      setAnimationProgress(Math.max(0, Math.min(100, scrollProgress)));
    };

    animatedSection0Container.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      animatedSection0Container.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  // Mobile: Hidden div scroll tracker for Section 0 (0-100)
  useEffect(() => {
    if (!isMobile) return;

    const hiddenScrollDiv = hiddenScrollDivRef.current;

    if (!hiddenScrollDiv) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = hiddenScrollDiv;
      const scrollProgress =
        scrollHeight > clientHeight
          ? (scrollTop / (scrollHeight - clientHeight)) * 100
          : 0;
      setAnimationProgress(Math.max(0, Math.min(100, scrollProgress)));
    };

    hiddenScrollDiv.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    // Initial calculation
    handleScroll();

    return () => {
      hiddenScrollDiv.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  // Auto-center Section 0 when user starts interacting
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const animatedSection0Container = isMobile
      ? animatedSceneSection0MobileRef.current
      : animatedSceneSection0Ref.current;
    const section0 = section0Ref.current;

    if (!scrollContainer || !animatedSection0Container || !section0) return;

    const positionElement = (element: HTMLElement) => {
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();

      // Calculate the absolute top position of the element
      const elementTop =
        elementRect.top +
        scrollContainer.scrollTop -
        scrollContainerRect.top;

      // On mobile, account for the 64px menu at the top
      const menuHeight = isMobile ? 64 : 0;
      const availableHeight = window.innerHeight - menuHeight;

      // Calculate the center of the section
      const elementHeight = element.offsetHeight;
      const elementCenter = elementTop + elementHeight / 2;

      // Calculate the target scroll to show section centered in available viewport
      const viewportCenter = menuHeight + availableHeight / 2;

      // On mobile, offset upward to show more of the top content (text + animation)
      // On desktop, keep perfectly centered
      const offset = isMobile ? availableHeight * 0.15 : 0;
      const targetScroll = elementCenter - viewportCenter - offset;

      // Smoothly scroll to position the element
      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
    };

    const handleSection0Interaction = (
      e: WheelEvent | MouseEvent | TouchEvent,
    ) => {
      if (animatedSection0Container?.contains(e.target as Node)) {
        // Position section 0 at the top of viewport (below menu)
        if (section0) positionElement(section0);
      }
    };

    // Add event listeners to detect scroll/touch start
    animatedSection0Container.addEventListener(
      "wheel",
      handleSection0Interaction as EventListener,
      { passive: true, once: true },
    );
    animatedSection0Container.addEventListener(
      "mouseenter",
      handleSection0Interaction as EventListener,
      { passive: true },
    );
    animatedSection0Container.addEventListener(
      "touchstart",
      handleSection0Interaction as EventListener,
      { passive: true, once: true },
    );

    return () => {
      animatedSection0Container.removeEventListener(
        "wheel",
        handleSection0Interaction as EventListener,
      );
      animatedSection0Container.removeEventListener(
        "mouseenter",
        handleSection0Interaction as EventListener,
      );
      animatedSection0Container.removeEventListener(
        "touchstart",
        handleSection0Interaction as EventListener,
      );
    };
  }, [isMobile]);

  return (
    <div style={getBlackBorderWrapper()}>
      <div style={getBackgroundStyle(isDarkMode)} />
      {/*<div style={getNoiseTextureStyle()} />*/}
      <div style={getBlackBorderInnerWrapper()} ref={scrollContainerRef}>
        <div style={getMenuStyle()}>
          <VibesSwitch size={64} />
          <div style={getButtonsWrapper()}>
            {/* <div className="navbar-button-wrapper">
              <button
                style={getButtonsNavbar("#EDCE02")}
                onClick={() => setIsSideMenuOpen(true)}
              >
                <div
                  className="navbar-button-icon"
                  style={getNavbarButtonIconWrapper()}
                >
                  <SettingsIcon
                    fill="var(--vibes-cream)"
                    bgFill="#231F20"
                    width={35}
                    height={35}
                  />
                </div>
                <div
                  className="navbar-button-label"
                  style={getNavbarButtonLabel()}
                >
                  Settings
                </div>
              </button>
            </div> */}
            <div className="navbar-button-wrapper">
              <button
                style={getButtonsNavbar(isDarkMode ? "#fa5c00ff" : "#5398c9")}
                onClick={toggleDarkMode}
              >
                <div
                  className="navbar-button-icon"
                  style={getNavbarButtonIconWrapper()}
                >
                  {isDarkMode ? (
                    <SunIcon
                      fill="var(--vibes-cream)"
                      bgFill="#231F20"
                      width={35}
                      height={35}
                    />
                  ) : (
                    <MoonIcon
                      fill="var(--vibes-cream)"
                      bgFill="#231F20"
                      width={35}
                      height={35}
                    />
                  )}
                </div>
                <div
                  className="navbar-button-label"
                  style={getNavbarButtonLabel()}
                >
                  {isDarkMode ? "Light" : "Dark"}
                </div>
              </button>
            </div>
            {/* <div className="navbar-button-wrapper">
              <button style={getButtonsNavbar("#D92A1C")} onClick={handleLogin}>
                <div
                  className="navbar-button-icon"
                  style={getNavbarButtonIconWrapper()}
                >
                  <LoginIcon
                    fill="var(--vibes-cream)"
                    bgFill="#231F20"
                    width={35}
                    height={35}
                  />
                </div>
                <div
                  className="navbar-button-label"
                  style={getNavbarButtonLabel()}
                >
                  Log In
                </div>
              </button>
            </div> */}
          </div>
        </div>

        <div
          style={{
            ...getScrollingBackgroundsStyle(),
            display: isDarkMode ? "none" : undefined,
          }}
        >
          {refsReady && (
            <>
              <div
                key={`bg0-${recalcCounter}`}
                style={getSection0BackgroundStyle(
                  section0Ref,
                  sectionsContainerRef,
                  isMobile,
                )}
              />
              <div
                key={`bg1-${recalcCounter}`}
                style={getSection1BackgroundStyle(
                  section1Ref,
                  sectionsContainerRef,
                  isMobile,
                )}
              />
              <div
                key={`bg3-${recalcCounter}`}
                style={getSection3BackgroundStyle(
                  section3Ref,
                  sectionsContainerRef,
                  isMobile,
                )}
              />
              <div
                key={`bg5-${recalcCounter}`}
                style={getSection5BackgroundStyle(
                  section5Ref,
                  sectionsContainerRef,
                  isMobile,
                )}
              />
              <div
                key={`bg8-${recalcCounter}`}
                style={getSection8BackgroundStyle(
                  section8Ref,
                  sectionsContainerRef,
                  isMobile,
                )}
              />
            </>
          )}
        </div>

        <div style={getWrapperStyle()} />

        <div style={getContainerStyle()}>
          <div style={getInnerContainerStyle(isMobile)} ref={innerContainerRef}>
            <DraggableSection color="grey" x={20} y={20} removePaddingTop>
              <h2 style={getHeroHeadingStyle()}>Impress the Group Chat</h2>
              <p style={getHeroSubheadingStyle()}>
                Instantly make your own apps on the fly
              </p>
            </DraggableSection>

            {isMobile && (
              <DraggableSection color="blue" x={20} y={170}>
                <ChatAnimation
                  title={selectedScenario.title}
                  arrayOfMessages={selectedScenario.arrayOfMessages}
                  user={"You"}
                />
              </DraggableSection>
            )}

            <DraggableCard color="red" x={860} y={180} isText>
              <p style={getCardTextStyle("270px", isMobile)}>
                Our <a href="http://fireproof.storage/">vibe coding database</a>{" "}
                encrypts all your data. Which means the group chat's stays
                local, portable, and safe.
              </p>
            </DraggableCard>

            <DraggableCard color="blue" x={620} y={60} isText>
              <p style={getCardTextStyle("250px", isMobile)}>
                No coding experience required. Just type an idea, and invite
                your friends.
              </p>
            </DraggableCard>

            <DraggableCard color="yellow" x={860} y={20} isText>
              <p style={getCardTextStyle()}>No app store. No downloads.</p>
            </DraggableCard>

            <DraggableCard color="grey" x={820} y={520}>
              <div style={getComputerAnimContainerStyle()}>
                <img src={computerAnimGif} style={getFullSizeImageStyle()} />
              </div>
            </DraggableCard>

            {!isMobile && (
              <>
                {" "}
                <DraggableCard color="yellow" x={250} y={1450}>
                  <p style={getImageCardStyle()}>
                    <img
                      src={rainbowComputer}
                      style={getFullSizeImageStyle()}
                    />
                  </p>
                </DraggableCard>
                <DraggableCard color="blue" x={950} y={2880}>
                  <p style={getImageCardStyle()}>
                    <img src={fireproofLogo} style={getFullSizeImageStyle()} />
                  </p>
                </DraggableCard>
                <DraggableCard color="yellow" x={830} y={4040}>
                  <p style={getImageCardStyleSmall("140px")}>
                    <img src={htmlpng} style={getFullSizeImageStyle()} />
                  </p>
                </DraggableCard>
                <DraggableCard color="yellow" x={900} y={5300}>
                  <img style={getImageCardStyleSmall("340px")} src={mouth} />
                </DraggableCard>
              </>
            )}

            {!isMobile && (
              <div
                className="chat-container-wrapper"
                style={getChatContainerStyleOut()}
              >
                <div className="chat-inner" style={getChatContainerStyle()}>
                  <div>
                    <div style={getChatContainerTopBar()} />
                    <div
                      style={getChatContainerBottomCard()}
                      ref={chatContainerRef}
                    >
                      {selectedScenario.title && (
                        <div style={getTitleStyle()}>
                          {selectedScenario.title}
                        </div>
                      )}
                      {selectedScenario.arrayOfMessages.map((msg, index) => {
                        const isCurrentUser = msg.user === "You";
                        const isLastMessage =
                          index === selectedScenario.arrayOfMessages.length - 1;
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
                            <div style={getMessageContentWrapperStyle()}>
                              <div style={getUsernameStyle(isCurrentUser)}>
                                {msg.user}
                              </div>
                              <div style={getMessageBubbleStyle(isCurrentUser)}>
                                {renderMessageWithLinks(msg.message)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            style={getSectionsContainerStyle(isMobile)}
            ref={sectionsContainerRef}
          >
            {/* Section 0: Create Section with Animated Scene */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                ...getSectionWithAnimatedSceneStyle(isMobile),
                paddingTop: isMobile ? "0px" : "100px",
              }}
              ref={section0Ref}
            >
              {/* Left column: Text sections that change based on progress (1/3 width) */}
              <div style={getAnimatedSectionTextColumnStyle(isMobile)}>
                {/* Section 1: 0-33% */}
                {animationProgress < 33 && (
                  <DraggableSection color="blue" static>
                    <h3 style={getSectionHeadingStyle("#5398c9")}>
                      You're about to make an app
                    </h3>
                    <div style={getContentWrapperStyle()}>
                      <b style={getSubheadingBoldStyle()}>
                        The front-end is the fun part
                      </b>
                      <p>
                        Let's start there. Let's say you want to make a simple
                        counter that keeps track of the number of times a group
                        of people click a red button.
                      </p>
                      <p>
                        Most AI models will give you something cool right away.
                      </p>
                    </div>
                  </DraggableSection>
                )}

                {/* Section 2: 33-66% */}
                {animationProgress >= 33 && animationProgress < 66 && (
                  <DraggableSection color="yellow" static>
                    <h3 style={getSectionHeadingStyle("#FEDD00")}>
                      Back to your counter app...
                    </h3>
                    <div style={getContentWrapperStyle()}>
                      <b style={getSubheadingBoldStyle()}>
                        Now you're using Fireproof + Vibes DIY
                      </b>
                      <span>
                        Your data lives locally inside your component, syncing
                        when and where you choose. Conflicts resolve sensibly.
                        State just... persists.
                      </span>
                      <span>
                        You can build offline, share instantly, and grow without
                        rewriting your stack. Even if you have no idea what any
                        of that means and just want to spell out an idea and get
                        an app. We got you.
                      </span>
                    </div>
                  </DraggableSection>
                )}

                {/* Section 3: 66-100% */}
                {animationProgress >= 66 && (
                  <DraggableSection color="red" static>
                    <h3 style={getSectionHeadingStyle("#D94827")}>
                      Build together, instantly
                    </h3>
                    <div style={getContentWrapperStyle()}>
                      <b style={getSubheadingBoldStyle()}>
                        No setup, no friction
                      </b>
                      <span>
                        Share your creations with a simple link. Your friends
                        can jump in immediately — no downloads, no waiting.
                      </span>
                      <span>
                        Everyone's changes sync in real-time, and your data
                        stays safe and encrypted locally. And the entire
                        community of Vibes is like a community-run app store
                        with no monopolist gatekeeper (shots fired).
                      </span>
                    </div>
                  </DraggableSection>
                )}
              </div>

              {/* Right column: AnimatedScene */}
              {isMobile ? (
                // Mobile: Container with placeholder and overlay
                <div
                  ref={animatedSceneContainer0MobileRef}
                  style={getScrollableAnimatedSceneMobileContainerStyle()}
                >
                  {/* Hidden scrollable div for slower animation */}
                  <div
                    ref={hiddenScrollDivRef}
                    style={getHiddenScrollDivStyle()}
                  >
                    <div style={getHiddenScrollDivInnerStyle()} />
                  </div>

                  {/* Mobile: Scrollable AnimatedScene overlay centered in container */}
                  <div
                    className="animated-scene-wrapper"
                    style={getScrollableAnimatedSceneWrapperStyle(isMobile)}
                    ref={animatedSceneSection0MobileRef}
                  >
                    <div style={getScrollableAnimatedSceneInnerStyle()}>
                      <div style={getStickyAnimatedSceneMobileStyle()}>
                        <AnimatedScene progress={animationProgress} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop: Visual placeholder (2/3 width) */}
                  <div style={getAnimatedSceneDesktopPlaceholderStyle()} />

                  {/* Desktop: Scrollable AnimatedScene overlay covering full section */}
                  <div
                    className="animated-scene-wrapper"
                    style={getScrollableAnimatedSceneWrapperStyle(isMobile)}
                    ref={animatedSceneSection0Ref}
                  >
                    <div style={getScrollableAnimatedSceneInnerStyle()}>
                      <div style={getStickyAnimatedSceneDesktopStyle()}>
                        {/* Empty space for left column (1/3) */}
                        <div
                          style={getStickyAnimatedSceneDesktopLeftSpacerStyle()}
                        />
                        {/* AnimatedScene in right area (2/3) */}
                        <div
                          style={getStickyAnimatedSceneDesktopRightContainerStyle()}
                        >
                          <AnimatedScene progress={animationProgress} />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Section 1: First part of content */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                paddingTop: isMobile ? "0px" : "200px",
              }}
              ref={section1Ref}
            >
              <div
                style={{
                  display: "flex",
                  width: isMobile ? "100%" : "calc(100% - 80px - 40px)",
                  margin: isMobile ? "0px" : "40px",
                  gap: isMobile ? "200px" : "30px",
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                {/* <div style={get1of3Column(isMobile)}>
                  <DraggableSection color="blue" static removeMargin>
                    <img src={vibesStack} style={{ flex: "100%" }} />
                  </DraggableSection>
                </div> */}
                <div style={get2of3Column(isMobile)}>
                  <DraggableSection color="blue" static removeMargin>
                    <h3 style={getSectionHeadingStyle("#5398c9")}>
                      The Vibe Coding Stack Made for Coding Agents
                    </h3>
                    <div style={getContentWrapperStyle()}>
                      <b style={getSubheadingBoldStyle()}>
                        It's not for you. It's for them.
                      </b>
                      <p>
                        Vibes DIY is so obsessed with making a better vibe
                        coding experience that we started by making our own
                        database. The Vibes DIY web stack is open source, and
                        uses a sync-engine powered by our database,{" "}
                        <a style={getLinkOutStyle()}>Fireproof </a>. Because{" "}
                        <a style={getLinkOutStyle()}>Fireproof</a> is local
                        first, your data lives in the browser, and syncs across
                        your users' browsers automatically. Without a virtual
                        machine + web server to make everything complicated.
                      </p>
                      <p>Our timing is good.</p>
                      <p>
                        Every generation of web tooling promises the same thing:
                        faster builds, fewer bugs, better DX. APIs got cleaner.
                        Frameworks got smarter.
                      </p>
                      <p>
                        And yet modern apps are still a maze of clients,
                        servers, endpoints, retries, caches, and edge cases. So
                        let's ask a different question...
                      </p>
                    </div>
                  </DraggableSection>
                </div>
                <div style={get1of3Column(isMobile)}>
                  <DraggableSection color="blue" static removeMargin>
                    <h3 style={getSectionHeadingStyle("#5398c9")}>
                      Let's Ask the AI.
                    </h3>
                    <div style={getContentWrapperStyle()}>
                      <b style={getSubheadingBoldStyle()}>
                        What do you actually want to generate?
                      </b>
                      <TerminalDemo isMobile={isMobile} />
                    </div>
                  </DraggableSection>
                </div>
              </div>
            </section>

            {/* Section 3: Second part of content */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                paddingTop: isMobile ? "0px" : "500px",
              }}
              ref={section3Ref}
            >
              <DraggableSection color="yellow" static>
                <h3 style={getSectionHeadingStyle("#FEDD00")}>
                  Now comes the hard part
                </h3>
                <div style={{ marginTop: "12px" }}>
                  {!isMobile && (
                    <img
                      src={vibeZoneChart}
                      alt="Vibe Zone chart showing Progress, Complexity, and Happiness over Time"
                      style={{
                        float: "right",
                        maxWidth: "525px",
                        marginLeft: "24px",
                        marginRight: "14px",
                        marginBottom: "16px",
                        borderRadius: "8px",
                      }}
                    />
                  )}
                  <b
                    style={{
                      ...getSubheadingBoldStyle(),
                      display: "block",
                      marginBottom: "18px",
                    }}
                  >
                    You're about to leave the Vibe Zone
                  </b>
                  <p style={{ marginBottom: "18px" }}>
                    Every vibe-coded project starts in the vibe zone.
                  </p>
                  {isMobile && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <img
                        src={vibeZoneChart}
                        alt="Vibe Zone chart showing Progress, Complexity, and Happiness over Time"
                        style={{
                          width: "100%",
                          marginBottom: "18px",
                          borderRadius: "8px",
                        }}
                      />
                    </div>
                  )}
                  <p style={{ marginBottom: "18px" }}>
                    The model understands you.
                    <br />
                    Progress is fast.
                    <br />
                    Each change moves the app forward.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    Then something small goes wrong.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    A slightly off assumption.
                    <br />
                    A fix that mostly works.
                    <br />A new edge case layered on top of the last one.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    You correct it.
                    <br />
                    Then correct the correction.
                    <br />
                    And suddenly progress slows to a crawl.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    You're not prompting wrong.
                    <br />
                    The model isn't failing.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    You've just drifted out of the vibe zone.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    Vibe coding works when state is simple and visible. It
                    breaks when complexity crosses a threshold the model can't
                    intuit or unwind.
                  </p>
                  <p style={{ marginBottom: "18px" }}>
                    Vibes DIY keeps things simple enough that you and your
                    coding agent stay where you want to be. In the vibe zone.
                  </p>
                  <div style={{ clear: "both" }} />
                </div>
              </DraggableSection>
            </section>

            {/* Section 5: Final content */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                paddingTop: isMobile ? "0px" : "500px",
              }}
              ref={section5Ref}
            >
              <DraggableSection color="red" static>
                <div style={getSecondCardStyle()}>
                  <h3 style={getSectionHeadingStyle("#DA291C")}>
                    One shot. Then Ship It.
                  </h3>
                  <div style={getContentWrapperStyle()}>
                    <b style={getSubheadingBoldStyle()}>
                      Get more app for your prompt.
                    </b>
                    <span>
                      When you vibe code an app, your coding agent has to choose
                      a web stack. When you tell your agent to use the Vibe
                      Stack, you're giving it an unfair advantage. Because Vibes
                      collapses <i>application code</i> and
                      <i>application state</i> into a single, local HTML file.
                    </span>
                    <span>
                      Think about it. AI doesn't make apps - it makes{" "}
                      <i>text</i>. Embedding the database in javascript (via the
                      browser) lets your agent describe an entire app—including
                      its persistence layer—<strong>in one shot</strong>.
                    </span>
                    <span>
                      This means the AI doesn't have to give you, the human,
                      instructions about how to setup a server, or import a
                      schema. It just gives you a working app. Fast. And it
                      works as pure HTML, so you're not locked into someone's
                      virtual server.
                    </span>
                    <span>
                      This yields a brand new vibe coding magic trick:
                      prompt-to-vibe. A single file encodes UI, logic, and seed
                      data, making vibe-coded apps trivially shareable and
                      endlessly remixable by your group chat.
                    </span>
                  </div>
                </div>
              </DraggableSection>
            </section>

            {/* Section 8: Light section */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                paddingTop: isMobile ? "0px" : "500px",
              }}
              ref={section8Ref}
            >
              <DraggableSection color="grey" static>
                <h3 style={getSectionHeadingStyle("#000000")}>
                  Join the party
                </h3>
                <div style={getContentWrapperStyle()}>
                  <b style={getSubheadingBoldStyle()}>
                    You're early. But right on time.
                  </b>
                  <span>
                    Volunteer sign-ups and school drop-offs. Project checklists
                    and vacation planners. Pick-up basketball schedules and
                    fantasy football rankings. A cooperative chore wheel for the
                    roomies and the ultimate Oscars bracket for movie club. Each
                    of these concepts can be vibe coded in <i>60 seconds</i>.
                    Whatever the vibe, you can build it with Vibes.
                  </span>
                  <span>
                    Everyone's ideas are welcome and everyone's data is
                    protected. This is software that communities build together
                    in real time — to make life easier, fairer, and more fun for
                    everyone.
                  </span>
                  <span>
                    You and your friends aren't users anymore. You're makers.
                  </span>
                  <span>
                    Curious? Try a prompt using our open source web builder.
                    <a
                      style={getLinkOutStyle()}
                      href="https://discord.gg/vnpWycj4Ta"
                    >
                      Join our Discord
                    </a>
                    ,{" "}
                    <a
                      style={getLinkOutStyle()}
                      href="https://vibesdiy.substack.com/"
                    >
                      read our Substack
                    </a>
                    , and follow us on
                    <a
                      style={getLinkOutStyle()}
                      href="https://www.youtube.com/@VibesDIY"
                    >
                      YouTube
                    </a>
                    ,{" "}
                    <a
                      style={getLinkOutStyle()}
                      href=" https://github.com/VibesDIY"
                    >
                      Github
                    </a>
                    , and{" "}
                    <a
                      style={getLinkOutStyle()}
                      href=" https://bsky.app/profile/vibes.diy"
                    >
                      Bluesky
                    </a>
                    .
                  </span>
                </div>
              </DraggableSection>
            </section>
          </div>
        </div>

        {/* Side Menu */}
        <SideMenu
          isOpen={isSideMenuOpen}
          onClose={() => setIsSideMenuOpen(false)}
          onLogin={handleLogin}
        />
      </div>
    </div>
  );
};

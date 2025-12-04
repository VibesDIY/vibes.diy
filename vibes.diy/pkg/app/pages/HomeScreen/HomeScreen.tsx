import React, { useEffect, useMemo, useRef, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { SideMenu } from "./SideMenu.js";
import {
  getContainerStyle,
  getWrapperStyle,
  getBackgroundStyle,
  getScrollingBackgroundsStyle,
  getMenuStyle,
  getInnerContainerStyle,
  getSectionsContainerStyle,
  getSecondCardStyle,
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
  getSection1BackgroundStyle,
  getSection2BackgroundStyle,
  getSection3BackgroundStyle,
  getSection4BackgroundStyle,
  getSection5BackgroundStyle,
  getSection6BackgroundStyle,
  getSection8BackgroundStyle,
  getLinkStyle,
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
  getStaticAnimatedSceneMobileContainerStyle,
  getAnimatedSceneDesktopPlaceholderStyle,
  getStaticAnimatedSceneDesktopOverlayStyle,
  getAnimatedSceneDesktopLeftSpacerStyle,
  getAnimatedSceneDesktopRightContainerStyle,
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
import computerAnimGif from "../../assets/computer-anim.gif";
import htmlpng from "../../assets/html.png";
import mouth from "../../assets/mouth.gif";
import rainbowComputer from "../../assets/rainbow-computer.gif";
import vibesStack from "../../assets/vibes-stack.png";
import fireproofLogo from "../../assets/fireproof-logo.png";
import {
  LoginIcon,
  SettingsIcon,
} from "../../../../../use-vibes/base/components/icons/index.js";

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
  const isDarkMode = usePrefersDarkMode();
  const clerk = useClerk();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneSection4Ref = useRef<HTMLDivElement>(null);
  const animatedSceneSection6Ref = useRef<HTMLDivElement>(null);
  const animatedSceneSection4MobileRef = useRef<HTMLDivElement>(null);
  const animatedSceneSection6MobileRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainer4MobileRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainer6MobileRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Shared login function used by both navbar and side menu
  const handleLogin = async () => {
    await clerk.redirectToSignIn({
      redirectUrl: window.location.href,
    });
  };

  // References for the 8 sections to calculate dynamic backgrounds
  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);
  const section4Ref = useRef<HTMLDivElement>(null);
  const section5Ref = useRef<HTMLDivElement>(null);
  const section6Ref = useRef<HTMLDivElement>(null);
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
      section1Ref.current &&
      section2Ref.current &&
      section3Ref.current &&
      section4Ref.current &&
      section5Ref.current &&
      section6Ref.current &&
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
    const animatedSection4Container = animatedSceneSection4Ref.current;
    const animatedSection6Container = animatedSceneSection6Ref.current;
    if (!innerContainer || !chatContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if the scroll event is happening inside the Section 2 animated scene container
      const isInsideSection2AnimatedScene =
        animatedSection4Container &&
        animatedSection4Container.contains(e.target as Node);

      // Check if the scroll event is happening inside the Section 4 animated scene container
      const isInsideSection4AnimatedScene =
        animatedSection6Container &&
        animatedSection6Container.contains(e.target as Node);

      // Check if the scroll event is happening inside the animated scene container
      const isInsideAnimatedScene =
        animatedContainer && animatedContainer.contains(e.target as Node);

      // For Section 2 and 4, let them scroll naturally - the scroll event listener will handle progress updates
      if (isInsideSection2AnimatedScene || isInsideSection4AnimatedScene) {
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

  // Desktop: Direct scroll listener for Section 4 AnimatedScene (0-50)
  useEffect(() => {
    if (isMobile) return; // Only run on desktop

    const animatedSection4Container = animatedSceneSection4Ref.current;
    if (!animatedSection4Container) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        animatedSection4Container;
      const scrollProgress =
        scrollHeight > clientHeight
          ? (scrollTop / (scrollHeight - clientHeight)) * 50
          : 0;
      setAnimationProgress(Math.max(0, Math.min(50, scrollProgress)));
    };

    animatedSection4Container.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      animatedSection4Container.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  // Desktop: Direct scroll listener for Section 6 AnimatedScene (50-100)
  useEffect(() => {
    if (isMobile) return; // Only run on desktop

    const animatedSection6Container = animatedSceneSection6Ref.current;
    if (!animatedSection6Container) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        animatedSection6Container;
      const scrollProgress =
        scrollHeight > clientHeight
          ? 50 + (scrollTop / (scrollHeight - clientHeight)) * 50
          : 50;
      setAnimationProgress(Math.max(50, Math.min(100, scrollProgress)));
    };

    animatedSection6Container.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      animatedSection6Container.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  // Mobile: Direct scroll listener for Section 4 AnimatedScene (0-50)
  useEffect(() => {
    if (!isMobile) return;

    const animatedSection4MobileContainer =
      animatedSceneSection4MobileRef.current;
    if (!animatedSection4MobileContainer) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        animatedSection4MobileContainer;
      const scrollProgress =
        scrollHeight > clientHeight
          ? (scrollTop / (scrollHeight - clientHeight)) * 50
          : 0;
      setAnimationProgress(Math.max(0, Math.min(50, scrollProgress)));
    };

    animatedSection4MobileContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      animatedSection4MobileContainer.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, [isMobile]);

  // Mobile: Direct scroll listener for Section 6 AnimatedScene (50-100)
  useEffect(() => {
    if (!isMobile) return;

    const animatedSection6MobileContainer =
      animatedSceneSection6MobileRef.current;
    if (!animatedSection6MobileContainer) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } =
        animatedSection6MobileContainer;
      const scrollProgress =
        scrollHeight > clientHeight
          ? 50 + (scrollTop / (scrollHeight - clientHeight)) * 50
          : 50;
      setAnimationProgress(Math.max(50, Math.min(100, scrollProgress)));
    };

    animatedSection6MobileContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      animatedSection6MobileContainer.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, [isMobile]);

  // Auto-center AnimatedScene sections when user starts interacting
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const section4 = section4Ref.current;
    const section6 = section6Ref.current;
    const animatedSection4Container = isMobile
      ? animatedSceneSection4MobileRef.current
      : animatedSceneSection4Ref.current;
    const animatedSection6Container = isMobile
      ? animatedSceneSection6MobileRef.current
      : animatedSceneSection6Ref.current;
    const container4Mobile = animatedSceneContainer4MobileRef.current;
    const container6Mobile = animatedSceneContainer6MobileRef.current;

    if (!scrollContainer) return;

    const centerElement = (element: HTMLElement) => {
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();

      // Calculate the scroll position needed to center the element
      const elementCenter =
        elementRect.top +
        scrollContainer.scrollTop -
        scrollContainerRect.top +
        elementRect.height / 2;

      // On mobile, account for the 64px menu at the top
      const menuHeight = isMobile ? 64 : 0;
      const availableHeight = window.innerHeight - menuHeight;
      const viewportCenter = menuHeight + availableHeight / 2;

      const targetScroll = elementCenter - viewportCenter;

      // Smoothly scroll to center the element
      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
    };

    const handleSection4Interaction = (
      e: WheelEvent | MouseEvent | TouchEvent,
    ) => {
      if (animatedSection4Container?.contains(e.target as Node)) {
        // On mobile, center the container; on desktop, center the section
        const targetElement =
          isMobile && container4Mobile ? container4Mobile : section4;
        if (targetElement) centerElement(targetElement);
      }
    };

    const handleSection6Interaction = (
      e: WheelEvent | MouseEvent | TouchEvent,
    ) => {
      if (animatedSection6Container?.contains(e.target as Node)) {
        // On mobile, center the container; on desktop, center the section
        const targetElement =
          isMobile && container6Mobile ? container6Mobile : section6;
        if (targetElement) centerElement(targetElement);
      }
    };

    // Add event listeners to detect scroll/touch start
    if (animatedSection4Container) {
      animatedSection4Container.addEventListener(
        "wheel",
        handleSection4Interaction as EventListener,
        { passive: true, once: true },
      );
      animatedSection4Container.addEventListener(
        "mouseenter",
        handleSection4Interaction as EventListener,
        { passive: true },
      );
      animatedSection4Container.addEventListener(
        "touchstart",
        handleSection4Interaction as EventListener,
        { passive: true, once: true },
      );
    }

    if (animatedSection6Container) {
      animatedSection6Container.addEventListener(
        "wheel",
        handleSection6Interaction as EventListener,
        { passive: true, once: true },
      );
      animatedSection6Container.addEventListener(
        "mouseenter",
        handleSection6Interaction as EventListener,
        { passive: true },
      );
      animatedSection6Container.addEventListener(
        "touchstart",
        handleSection6Interaction as EventListener,
        { passive: true, once: true },
      );
    }

    return () => {
      if (animatedSection4Container) {
        animatedSection4Container.removeEventListener(
          "wheel",
          handleSection4Interaction as EventListener,
        );
        animatedSection4Container.removeEventListener(
          "mouseenter",
          handleSection4Interaction as EventListener,
        );
        animatedSection4Container.removeEventListener(
          "touchstart",
          handleSection4Interaction as EventListener,
        );
      }
      if (animatedSection6Container) {
        animatedSection6Container.removeEventListener(
          "wheel",
          handleSection6Interaction as EventListener,
        );
        animatedSection6Container.removeEventListener(
          "mouseenter",
          handleSection6Interaction as EventListener,
        );
        animatedSection6Container.removeEventListener(
          "touchstart",
          handleSection6Interaction as EventListener,
        );
      }
    };
  }, [isMobile]);

  return (
    <div style={getBlackBorderWrapper()}>
      <div style={getBackgroundStyle()} />
      {/*<div style={getNoiseTextureStyle()} />*/}
      <div style={getBlackBorderInnerWrapper()} ref={scrollContainerRef}>
        <div style={getMenuStyle()}>
          <VibesSwitch size={64} />
          <div style={getButtonsWrapper()}>
            <div className="navbar-button-wrapper">
              <button
                style={getButtonsNavbar("#EDCE02")}
                onClick={() => setIsSideMenuOpen(true)}
              >
                <div
                  className="navbar-button-icon"
                  style={getNavbarButtonIconWrapper()}
                >
                  <SettingsIcon
                    fill="#fffff0"
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
            </div>
            <div className="navbar-button-wrapper">
              <button style={getButtonsNavbar("#D92A1C")} onClick={handleLogin}>
                <div
                  className="navbar-button-icon"
                  style={getNavbarButtonIconWrapper()}
                >
                  <LoginIcon
                    fill="#fffff0"
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
            </div>
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
                key={`bg1-${recalcCounter}`}
                style={getSection1BackgroundStyle(
                  section1Ref,
                  sectionsContainerRef,
                  isMobile,
                )}
              />
              <div
                key={`bg2-${recalcCounter}`}
                style={getSection2BackgroundStyle(
                  section2Ref,
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
                key={`bg4-${recalcCounter}`}
                style={getSection4BackgroundStyle(
                  section4Ref,
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
                key={`bg6-${recalcCounter}`}
                style={getSection6BackgroundStyle(
                  section6Ref,
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
                Our unhackable{" "}
                <a href="http://fireproof.storage/">vibe coding database</a>{" "}
                encrypts all your data. Which means the group chat's lore stays
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

            <DraggableCard color="yellow" x={1000} y={1700}>
              <p style={getImageCardStyle()}>
                <img src={rainbowComputer} style={getFullSizeImageStyle()} />
              </p>
            </DraggableCard>
            <DraggableCard color="blue" x={950} y={2880}>
              <p style={getImageCardStyle()}>
                <img src={fireproofLogo} style={getFullSizeImageStyle()} />
              </p>
            </DraggableCard>

            <DraggableCard color="yellow" x={830} y={5240}>
              <p style={getImageCardStyleSmall("140px")}>
                <img src={htmlpng} style={getFullSizeImageStyle()} />
              </p>
            </DraggableCard>

            <DraggableCard color="yellow" x={700} y={7000}>
              <img style={getImageCardStyleSmall("340px")} src={mouth} />
            </DraggableCard>

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
            {/* Section 1: First part of content */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                paddingTop: isMobile ? "0px" : "200px",
              }}
              ref={section1Ref}
            >
              <div
                style={{ display: "flex", gap: "30px", flexDirection: "row" }}
              >
                <DraggableSection color="blue" static>
                  <div style={{ width: "40%" }}>
                    <img src={vibesStack} style={{ width: "100%" }} />
                  </div>
                </DraggableSection>
                <DraggableSection color="blue" static>
                  <h3 style={getSectionHeadingStyle("#5398c9")}>
                    The Vibe Coding Stack That Fits In Your Pocket
                  </h3>
                  <b style={getSubheadingBoldStyle()}>
                    Vibes is an open source web stack was designed for vibe
                    coding - easy, fast, secure, and portable
                  </b>
                  <span>
                    <b>Easy</b> because it uses Fireproof, a database that lives
                    in your web browser and syncs without a web server.
                  </span>
                  <span>
                    <b>Fast</b> because the data is local, so you don't need to
                    ask a server for it.
                  </span>
                  <span>
                    <b>Secure</b> because all data is encrypted by default. No
                    .env variables to accidentally check into Github!
                  </span>
                  <span>
                    <b>Portable</b>, because you don't have to host these apps
                    with us. It's all open source - Vibes work anywhere the web
                    works.
                  </span>
                </DraggableSection>
              </div>
            </section>

            {/* Section 2: AnimatedScene 0-50 */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                ...getSectionWithAnimatedSceneStyle(isMobile),
                paddingTop: isMobile ? "0px" : "100px",
              }}
              ref={section2Ref}
            >
              {/* Left column: Text (1/3 width) */}
              <div style={getAnimatedSectionTextColumnStyle(isMobile)}>
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
                      counter that keeps track of the number of times a group of
                      people click a red button.
                    </p>
                    <p>
                      Most AI models will give you something cool right away.
                    </p>
                  </div>
                </DraggableSection>
              </div>

              {/* Right column: AnimatedScene */}
              {isMobile ? (
                // Mobile: Container with same size as other animated sections
                <div style={getStaticAnimatedSceneMobileContainerStyle()}>
                  <AnimatedScene progress={0} />
                </div>
              ) : (
                <>
                  {/* Desktop: Visual placeholder (2/3 width) */}
                  <div style={getAnimatedSceneDesktopPlaceholderStyle()} />

                  {/* Desktop: AnimatedScene overlay covering full section */}
                  <div style={getStaticAnimatedSceneDesktopOverlayStyle()}>
                    {/* Empty space for left column (1/3) */}
                    <div style={getAnimatedSceneDesktopLeftSpacerStyle()} />
                    {/* AnimatedScene in right area (2/3) */}
                    <div style={getAnimatedSceneDesktopRightContainerStyle()}>
                      <AnimatedScene progress={0} />
                    </div>
                  </div>
                </>
              )}
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
                <div style={getContentWrapperStyle()}>
                  <b style={getSubheadingBoldStyle()}>
                    Multiplayer features need a backend
                  </b>
                  <span>
                    And backends are hard. You're a vibe coder, not a "DevOps"
                    expert. Messing this part up is how vibe coded apps get
                    hacked. You can either try to connect to something like
                    Supabase, which is complicated and expensive. Or let someone
                    build you a backend that you'll be stuck with forever.
                  </span>
                  <b style={getSubheadingBoldStyle()}>Here's the problem</b>
                  <span>
                    You're trying to vibe code using a web stack that was made
                    for a different problem: building a huge startup with giant
                    teams of <i>actual</i> programmers using millions in venture
                    capital.
                  </span>
                  <b style={getSubheadingBoldStyle()}>
                    Your web stack wasn't made for vibe coding
                  </b>
                  <span>
                    Most web stacks are built for mass-market software: big
                    schemas, strict permissions, endless backend plumbing. Tools
                    like Supabase and row-level auth policies work fine for
                    enterprise apps — but they slow down small, personal,
                    shareable ones.
                  </span>
                  <span>
                    Vibes DIY takes a different approach. It treats data as part
                    of your creative surface, not a distant backend. None of
                    this would be possible if you still needed a backend to sync
                    data between users. But, doesn't everybody need a backend
                    for multiplayer data?
                  </span>
                  <h3 style={getSectionHeadingStyle("#FEDD00")}>
                    We made a database designed for vibe coding
                  </h3>
                  <b style={getSubheadingBoldStyle()}>
                    Fireproof makes the web server into a horseless carriage
                  </b>
                  <span>
                    Vibes DIY runs on Fireproof, an open source embedded
                    database that syncs without a web server. It treats data as
                    part of your creative surface, not a corporate cloud
                    service. Fireproof uses distributed data structures, CRDTs,
                    content-addressed storage, and document-style records to
                    give every app its own lightweight ledger.
                  </span>
                </div>
              </DraggableSection>
            </section>

            {/* Section 4: AnimatedScene 50-100 */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                ...getSectionWithAnimatedSceneStyle(isMobile),
              }}
              ref={section4Ref}
            >
              {/* Left column: Text (1/3 width) */}
              <div style={getAnimatedSectionTextColumnStyle(isMobile)}>
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
                      rewriting your stack. Even if you have no idea what any of
                      that means and just want to spell out an idea and get an
                      app. We got you.
                    </span>
                  </div>
                </DraggableSection>
              </div>

              {/* Right column: AnimatedScene */}
              {isMobile ? (
                // Mobile: Container with placeholder and overlay
                <div
                  ref={animatedSceneContainer4MobileRef}
                  style={getScrollableAnimatedSceneMobileContainerStyle()}
                >
                  {/* Mobile: Scrollable AnimatedScene overlay centered in container */}
                  <div
                    className="animated-scene-wrapper"
                    style={getScrollableAnimatedSceneWrapperStyle(isMobile)}
                    ref={animatedSceneSection4MobileRef}
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
                    ref={animatedSceneSection4Ref}
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

            {/* Section 6: AnimatedScene at 0 (no movement) - Red */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                ...getSectionWithAnimatedSceneStyle(isMobile),
              }}
              ref={section6Ref}
            >
              {/* Left column: Text (1/3 width) */}
              <div style={getAnimatedSectionTextColumnStyle(isMobile)}>
                <DraggableSection color="red" static>
                  <h3 style={getSectionHeadingStyle("#D94827")}>
                    Build together, instantly
                  </h3>
                  <div style={getContentWrapperStyle()}>
                    <b style={getSubheadingBoldStyle()}>
                      No setup, no friction
                    </b>
                    <span>
                      Share your creations with a simple link. Your friends can
                      jump in immediately — no downloads, no waiting.
                    </span>
                    <span>
                      Everyone's changes sync in real-time, and your data stays
                      safe and encrypted locally. And the entire community of
                      Vibes is like a community-run app store with no monopolist
                      gatekeeper (shots fired).
                    </span>
                  </div>
                </DraggableSection>
              </div>

              {/* Right column: AnimatedScene */}
              {isMobile ? (
                // Mobile: Container with placeholder and overlay
                <div
                  ref={animatedSceneContainer6MobileRef}
                  style={getScrollableAnimatedSceneMobileContainerStyle()}
                >
                  {/* Mobile: Scrollable AnimatedScene overlay centered in container */}
                  <div
                    className="animated-scene-wrapper"
                    style={getScrollableAnimatedSceneWrapperStyle(isMobile)}
                    ref={animatedSceneSection6MobileRef}
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
                    ref={animatedSceneSection6Ref}
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

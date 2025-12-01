import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "./HomeScreen.styles.js";
import {
  ChatAnimation,
  DraggableCard,
  DraggableSection,
  VibesSwitch,
} from "../../components/index.js";
import { HomeScreenProps } from "./HomeScreen.types.js";
import { useIsMobile } from "../../hooks/index.js";
import { AnimatedScene } from "./AnimatedScene.js";
import computerAnimGif from "../../assets/computer-anim.gif";

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
          style={{
            color: "inherit",
            textDecoration: "underline",
            cursor: "pointer",
          }}
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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneSection4Ref = useRef<HTMLDivElement>(null);
  const animatedSceneSection6Ref = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isAnimationLocked, setIsAnimationLocked] = useState(false);
  const [activeSection, setActiveSection] = useState<4 | 6 | null>(null);
  const hasCompletedSection4 = useRef(false);
  const hasCompletedSection6 = useRef(false);
  const scrollAccumulator = useRef(0);

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

  // Direct scroll listener for Section 2 AnimatedScene (0-50)
  useEffect(() => {
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
  }, []);

  // Direct scroll listener for Section 4 AnimatedScene (50-100)
  useEffect(() => {
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
  }, []);

  // Auto-center AnimatedScene sections when user starts interacting
  useEffect(() => {
    if (isMobile) return;

    const scrollContainer = scrollContainerRef.current;
    const section4 = section4Ref.current;
    const section6 = section6Ref.current;
    const animatedSection4Container = animatedSceneSection4Ref.current;
    const animatedSection6Container = animatedSceneSection6Ref.current;

    if (!scrollContainer) return;

    const centerSection = (section: HTMLElement) => {
      const sectionRect = section.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();

      // Calculate the scroll position needed to center the section
      const sectionCenter =
        sectionRect.top +
        scrollContainer.scrollTop -
        scrollContainerRect.top +
        sectionRect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      const targetScroll = sectionCenter - viewportCenter;

      // Smoothly scroll to center the section
      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
    };

    const handleSection4Interaction = (e: WheelEvent | MouseEvent) => {
      if (section4 && animatedSection4Container?.contains(e.target as Node)) {
        centerSection(section4);
      }
    };

    const handleSection6Interaction = (e: WheelEvent | MouseEvent) => {
      if (section6 && animatedSection6Container?.contains(e.target as Node)) {
        centerSection(section6);
      }
    };

    // Add wheel event listeners to detect scroll start
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
      }
    };
  }, [isMobile]);

  // Mobile: Detect when sections reach center and lock them
  useEffect(() => {
    if (!isMobile) return;

    const scrollContainer = scrollContainerRef.current;
    const section4 = section4Ref.current;
    const section6 = section6Ref.current;

    if (!scrollContainer || !section4 || !section6) return;

    const handlePageScroll = () => {
      // Skip if already locked
      if (isAnimationLocked) return;

      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;

      // Check section 4
      if (!hasCompletedSection4.current) {
        const rect4 = section4.getBoundingClientRect();
        const section4Center = rect4.top + rect4.height / 2;
        const distanceFromCenter = Math.abs(section4Center - viewportCenter);

        // Lock when within 50px of center
        if (distanceFromCenter < 50) {
          setActiveSection(4);
          setIsAnimationLocked(true);
          setAnimationProgress(0);
          scrollAccumulator.current = 0;
          return;
        }
      }

      // Check section 6
      if (!hasCompletedSection6.current) {
        const rect6 = section6.getBoundingClientRect();
        const section6Center = rect6.top + rect6.height / 2;
        const distanceFromCenter = Math.abs(section6Center - viewportCenter);

        // Lock when within 50px of center
        if (distanceFromCenter < 50) {
          setActiveSection(6);
          setIsAnimationLocked(true);
          setAnimationProgress(50);
          scrollAccumulator.current = 0;
          return;
        }
      }
    };

    scrollContainer.addEventListener("scroll", handlePageScroll, { passive: true });
    handlePageScroll(); // Initial call

    return () => {
      scrollContainer.removeEventListener("scroll", handlePageScroll);
    };
  }, [isMobile, isAnimationLocked]);

  // Mobile: Convert scroll to animation progress when locked
  useEffect(() => {
    if (!isMobile || !isAnimationLocked || activeSection === null) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const SCROLL_SENSITIVITY = 3; // pixels per 1% progress

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      scrollAccumulator.current += e.deltaY;
      const progressDelta = scrollAccumulator.current / SCROLL_SENSITIVITY;

      let newProgress: number;
      if (activeSection === 4) {
        newProgress = Math.max(0, Math.min(50, animationProgress + progressDelta));
      } else {
        newProgress = Math.max(50, Math.min(100, animationProgress + progressDelta));
      }

      setAnimationProgress(newProgress);

      if (Math.abs(progressDelta) >= 1) {
        scrollAccumulator.current = 0;
      }

      // Check if complete
      const isComplete =
        (activeSection === 4 && newProgress >= 50) ||
        (activeSection === 6 && newProgress >= 100);

      if (isComplete) {
        if (activeSection === 4) {
          hasCompletedSection4.current = true;
        } else {
          hasCompletedSection6.current = true;
        }
        setIsAnimationLocked(false);
        setActiveSection(null);
        scrollAccumulator.current = 0;
      }
    };

    scrollContainer.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      scrollContainer.removeEventListener("wheel", handleWheel);
    };
  }, [isMobile, isAnimationLocked, activeSection, animationProgress]);


  return (
    <div style={getBlackBorderWrapper()}>
      <div style={getBackgroundStyle()} />
      {/*<div style={getNoiseTextureStyle()} />*/}
      <div style={getBlackBorderInnerWrapper()} ref={scrollContainerRef}>
        <div style={getMenuStyle()}>
          <VibesSwitch size={64} />
        </div>

        <div style={getScrollingBackgroundsStyle()}>
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
              <h2
                style={{
                  fontWeight: "bold",
                  fontSize: "50px",
                  lineHeight: "50px",
                }}
              >
                Impress the Group Chat
              </h2>
              <p
                style={{
                  fontWeight: "bold",
                  fontSize: "22px",
                  lineHeight: "36px",
                }}
              >
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

            <DraggableCard color="blue" x={550} y={120}>
              <p
                style={{
                  maxWidth: "250px",
                  fontWeight: "bold",
                  fontSize: "20px",
                  lineHeight: "25px",
                }}
              >
                No coding experience required. Just type an idea, and invite
                your friends. Our{" "}
                <a href="http://fireproof.storage/">
                  purpose-built vibe coding database
                </a>{" "}
                automatically encrypts all your data. Which means the group
                chat's lore stays local, portable, and safe.
              </p>
            </DraggableCard>

            <DraggableCard color="grey" x={820} y={520}>
              <div
                style={{
                  position: "relative",
                  margin: "-16px -8px",
                  width: "320px",
                  height: "242px",
                }}
              >
                <img
                  src={computerAnimGif}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                  }}
                />
              </div>
            </DraggableCard>

            <DraggableCard color="yellow" x={800} y={20}>
              <p
                style={{
                  fontWeight: "bold",
                  fontSize: "20px",
                  lineHeight: "25px",
                }}
              >
                No app store. No downloads.
              </p>
            </DraggableCard>

            <DraggableCard color="red" x={800} y={320}>
              <p
                style={{
                  maxWidth: "200px",
                  fontWeight: "bold",
                  fontSize: "20px",
                  lineHeight: "25px",
                }}
              >
                Custom community apps. Made by and for your friends, for
                everything you do together.
              </p>
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
                            <div style={{ width: "100%" }}>
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
                paddingTop: isMobile ? "0px" : "500px",
              }}
              ref={section1Ref}
            >
              <DraggableSection color="blue" static>
                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#5398c9",
                    lineHeight: "40px",
                  }}
                >
                  Community Code
                </h3>
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                  }}
                >
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>For people who care about people</b>
                  <span>
                    Your group chat isn't a start-up. It's a community, and every
                    community has its own unique needs. So why should you rely on
                    one-sized-fits-all apps made by people who care more about
                    shareholders than stakeholders? Infinitely remixable,
                    small-scale software made for the people you love: that's the
                    vibe.</span>

                  <h3
                    style={{
                      fontWeight: "bold",
                      fontSize: "40px",
                      color: "#5398c9",
                      lineHeight: "40px",
                    }}
                  >
                    The App to End all Apps
                  </h3>
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>What you need and nothing else</b>
                  <span>
                    Vibes is every app you could ever need in one place — with no
                    app store, no downloads, and no software updates. It's a tool
                    for building what you need, only when you need it. Share your
                    creations instantly with the group chat and mix them up
                    together. Best of all, everyone's data stays local, portable,
                    and safe.
                  </span>
                </div>
              </DraggableSection>
            </section>

            {/* Section 2: AnimatedScene 0-50 */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                gap: isMobile ? "20px" : "0px",
                flexDirection: isMobile ? "column" : "row",
              }}
              ref={section2Ref}
            >
              {/* Left column: Text (1/3 width) */}
              <div
                style={{
                  flex: isMobile ? "1" : "0 0 33.33%",
                  display: "flex",
                  alignItems: "center",
                  zIndex: isMobile ? "auto" : 1,
                  position: "relative",
                }}
              >
                <DraggableSection color="blue" static>
                  <h3
                    style={{
                      fontWeight: "bold",
                      fontSize: "40px",
                      color: "#5398c9",
                      lineHeight: "40px",
                    }}
                  >
                    You're about to make an app
                  </h3>
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <b style={{ fontSize: "28px", lineHeight: "28px" }}>
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
                // Mobile: AnimatedScene flows normally in layout
                <div
                  style={{
                    flex: "1",
                    position: "relative",
                    minHeight: "400px",
                  }}
                >
                  <AnimatedScene progress={0} />
                </div>
              ) : (
                <>
                  {/* Desktop: Visual placeholder (2/3 width) */}
                  <div
                    style={{
                      flex: "0 0 66.66%",
                      position: "relative",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Desktop: AnimatedScene overlay covering full section */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      right: 0,
                      transform: "translateY(-50%)",
                      height: "100vh",
                      display: "flex",
                      alignItems: "center",
                      pointerEvents: "none",
                      zIndex: 0,
                    }}
                  >
                    {/* Empty space for left column (1/3) */}
                    <div style={{ flex: "0 0 33.33%" }} />
                    {/* AnimatedScene in right area (2/3) */}
                    <div
                      style={{
                        flex: "0 0 66.66%",
                        position: "relative",
                        height: "100%",
                      }}
                    >
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
                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#FEDD00",
                    lineHeight: "40px",
                  }}
                >
                  Now comes the hard part
                </h3>
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                  }}
                >
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>Multiplayer features need a backend</b>
                  <span>And backends are hard. You're a vibe coder, not a "DevOps"
                    expert. Messing this part up is how vibe coded apps get
                    hacked. You can either try to connect to something like
                    Supabase, which is complicated and expensive. Or let someone
                    build you a backend that you'll be stuck with forever.</span>
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>Here's the problem</b>
                  <span>You're trying to vibe code using a web stack that was made for
                    a different problem: building a huge startup with giant teams
                    of <i>actual</i> programmers using millions in venture
                    capital.</span>
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>Your web stack wasn't made for vibe coding</b>
                  <span>Most web stacks are built for mass-market software: big
                    schemas, strict permissions, endless backend plumbing. Tools
                    like Supabase and row-level auth policies work fine for
                    enterprise apps — but they slow down small, personal,
                    shareable ones.</span>
                  <span>Vibes DIY takes a different approach. It treats data as part
                    of your creative surface, not a distant backend. None of this
                    would be possible if you still needed a backend to sync data
                    between users. But, doesn't everybody need a backend for
                    multiplayer data?</span>
                  <h3
                    style={{
                      fontWeight: "bold",
                      fontSize: "40px",
                      color: "#FEDD00",
                      lineHeight: "40px",
                    }}
                  >
                    We made a database designed for vibe coding
                  </h3>
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>
                    Fireproof makes the web server into a horseless carriage
                  </b>
                  <span>Vibes DIY runs on Fireproof, an open source embedded database
                    that syncs without a web server. It treats data as part of
                    your creative surface, not a corporate cloud service.
                    Fireproof uses distributed data structures, CRDTs,
                    content-addressed storage, and document-style records to give
                    every app its own lightweight ledger.</span>
                </div>
              </DraggableSection>
            </section>

            {/* Section 4: AnimatedScene 50-100 */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                gap: isMobile ? "20px" : "0px",
                flexDirection: isMobile ? "column" : "row",
              }}
              ref={section4Ref}
            >
              {/* Left column: Text (1/3 width) */}
              <div
                style={{
                  flex: isMobile ? "1" : "0 0 33.33%",
                  display: "flex",
                  alignItems: "center",
                  zIndex: isMobile ? "auto" : 1,
                  position: "relative",
                }}
              >
                <DraggableSection color="yellow" static>
                  <h3
                    style={{
                      fontWeight: "bold",
                      fontSize: "40px",
                      color: "#FEDD00",
                      lineHeight: "40px",
                    }}
                  >
                    Back to your counter app...
                  </h3>
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <b style={{ fontSize: "28px", lineHeight: "28px" }}>Now you're using Fireproof + Vibes DIY</b>
                    <span>Your data lives locally inside your component, syncing when
                      and where you choose. Conflicts resolve sensibly. State
                      just... persists.</span>
                    <span>
                      You can build offline, share instantly, and grow without
                      rewriting your stack. Even if you have no idea what any of
                      that means and just want to spell out an idea and get an
                      app. We got you.</span>
                  </div>
                </DraggableSection>
              </div>

              {/* Right column: AnimatedScene */}
              {isMobile ? (
                // Mobile: Container that locks to center during animation
                <div
                  style={{
                    flex: "1",
                    position: "relative",
                    minHeight: "100vh",
                  }}
                >
                  <div
                    style={{
                      position: isAnimationLocked && activeSection === 4 ? "fixed" : "relative",
                      top: isAnimationLocked && activeSection === 4 ? "50%" : "auto",
                      left: isAnimationLocked && activeSection === 4 ? "0" : "auto",
                      right: isAnimationLocked && activeSection === 4 ? "0" : "auto",
                      transform: isAnimationLocked && activeSection === 4 ? "translateY(-50%)" : "none",
                      width: "100%",
                      minHeight: "400px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: isAnimationLocked && activeSection === 4 ? 9999 : "auto",
                    }}
                  >
                    <AnimatedScene progress={animationProgress} />
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop: Visual placeholder (2/3 width) */}
                  <div
                    style={{
                      flex: "0 0 66.66%",
                      position: "relative",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Desktop: Scrollable AnimatedScene overlay covering full section */}
                  <div
                    className="animated-scene-wrapper"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      right: 0,
                      transform: "translateY(-50%)",
                      height: "100vh",
                      overflowY: "auto",
                      overflowX: "hidden",
                      background: "transparent",
                      zIndex: 10,
                      pointerEvents: "auto",
                    }}
                    ref={animatedSceneSection4Ref}
                  >
                    <div style={{ height: "200vh" }}>
                      <div
                        style={{
                          position: "sticky",
                          top: 0,
                          width: "100%",
                          height: "100vh",
                          display: "flex",
                        }}
                      >
                        {/* Empty space for left column (1/3) */}
                        <div
                          style={{ flex: "0 0 33.33%", pointerEvents: "none" }}
                        />
                        {/* AnimatedScene in right area (2/3) */}
                        <div
                          style={{ flex: "0 0 66.66%", position: "relative" }}
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
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <span>You love your group chat. Meet your group app. </span>
                    <span>
                      Remember that camping trip when nobody packed coffee? The
                      Friendsgiving with six mac n' cheeses and no turkey? You
                      love your friends, but organizing them can be a headache.
                      Make planning painless with custom community apps, made by
                      and for your friends, for everything you do together.
                    </span>
                    <span>
                      Like volunteer sign-ups and school drop-offs. Project
                      checklists and vacation planners. Pick-up basketball
                      schedules and fantasy football rankings. A cooperative chore
                      wheel for the roomies and the ultimate Oscars bracket for
                      movie club. Whatever the vibe, you can build it with Vibes.
                    </span>
                    <span>
                      Share and use your new apps instantly, and remix them on the
                      fly. Everyone's ideas are welcome and everyone's data is
                      protected. This is software that communities build together
                      in real time — to make life easier, fairer, and more fun for
                      everyone.
                    </span>
                    <span>
                      You and your friends aren't users anymore. You're makers.
                    </span>
                  </div>
                </div>
              </DraggableSection>
            </section>

            {/* Section 6: AnimatedScene at 0 (no movement) - Red */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                gap: isMobile ? "20px" : "0px",
                flexDirection: isMobile ? "column" : "row",
              }}
              ref={section6Ref}
            >
              {/* Left column: Text (1/3 width) */}
              <div
                style={{
                  flex: isMobile ? "1" : "0 0 33.33%",
                  display: "flex",
                  alignItems: "center",
                  zIndex: isMobile ? "auto" : 1,
                  position: "relative",
                }}
              >
                <DraggableSection color="red" static>
                  <h3
                    style={{
                      fontWeight: "bold",
                      fontSize: "40px",
                      color: "#D94827",
                      lineHeight: "40px",
                    }}
                  >
                    Build together, instantly
                  </h3>
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <b style={{ fontSize: "28px", lineHeight: "28px" }}>No setup, no friction</b>
                    <span>
                      Share your creations with a simple link. Your friends can
                      jump in immediately — no downloads, no sign-ups, no waiting.
                    </span>
                    <span>
                      Everyone's changes sync in real-time, and your data stays
                      safe and encrypted locally.</span>
                  </div>
                </DraggableSection>
              </div>

              {/* Right column: AnimatedScene */}
              {isMobile ? (
                // Mobile: Container that locks to center during animation
                <div
                  style={{
                    flex: "1",
                    position: "relative",
                    minHeight: "100vh",
                  }}
                >
                  <div
                    style={{
                      position: isAnimationLocked && activeSection === 6 ? "fixed" : "relative",
                      top: isAnimationLocked && activeSection === 6 ? "50%" : "auto",
                      left: isAnimationLocked && activeSection === 6 ? "0" : "auto",
                      right: isAnimationLocked && activeSection === 6 ? "0" : "auto",
                      transform: isAnimationLocked && activeSection === 6 ? "translateY(-50%)" : "none",
                      width: "100%",
                      minHeight: "400px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: isAnimationLocked && activeSection === 6 ? 9999 : "auto",
                    }}
                  >
                    <AnimatedScene progress={animationProgress} />
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop: Visual placeholder (2/3 width) */}
                  <div
                    style={{
                      flex: "0 0 66.66%",
                      position: "relative",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Desktop: Scrollable AnimatedScene overlay covering full section */}
                  <div
                    className="animated-scene-wrapper"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      right: 0,
                      transform: "translateY(-50%)",
                      height: "100vh",
                      overflowY: "auto",
                      overflowX: "hidden",
                      background: "transparent",
                      zIndex: 10,
                      pointerEvents: "auto",
                    }}
                    ref={animatedSceneSection6Ref}
                  >
                    <div style={{ height: "200vh" }}>
                      <div
                        style={{
                          position: "sticky",
                          top: 0,
                          width: "100%",
                          height: "100vh",
                          display: "flex",
                        }}
                      >
                        {/* Empty space for left column (1/3) */}
                        <div
                          style={{ flex: "0 0 33.33%", pointerEvents: "none" }}
                        />
                        {/* AnimatedScene in right area (2/3) */}
                        <div
                          style={{ flex: "0 0 66.66%", position: "relative" }}
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
                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#000000",
                    lineHeight: "40px",
                  }}
                >
                  Section 8
                </h3>
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                  }}
                >
                  <b style={{ fontSize: "28px", lineHeight: "28px" }}>Content for light section</b>
                  <span>
                    This is the light section with color oklch(84.6% 0.026 111).</span>
                </div>
              </DraggableSection>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

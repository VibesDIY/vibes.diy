import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getContainerStyle,
  getWrapperStyle,
  getBackgroundStyle,
  getNoiseTextureStyle,
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
              <h2 style={{ fontWeight: "bold", fontSize: "50px", lineHeight: '50px' }}>
                Impress the Group Chat
              </h2>
              <p style={{ fontWeight: "bold", fontSize: "22px", lineHeight: '36px'  }}>
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
              <p style={{ maxWidth: "250px", fontWeight: "bold", fontSize: '20px', lineHeight: '25px' }}>
                No coding experience required. Just type an idea, and invite your friends. Our <a href="http://fireproof.storage/">purpose-built vibe coding database</a>{' '}  
                automatically encrypts all your data. Which means the group chat's lore 
                stays local, portable, and safe.
              </p>
            </DraggableCard>

            <DraggableCard color="grey" x={870} y={100}>
              <img src={computerAnimGif} style={{ width: "150px", fontSize: '20px', lineHeight: '25px' }} />
            </DraggableCard>

            <DraggableCard color="yellow" x={800} y={20}>
              <p style={{ fontWeight: "bold", fontSize: '20px', lineHeight: '25px' }}>No app store. No downloads.</p>
            </DraggableCard>

            <DraggableCard color="red" x={800} y={320}>
              <p style={{ maxWidth: "200px", fontWeight: "bold", fontSize: '20px', lineHeight: '25px' }}>
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
                  }}
                >
                  Community Code
                </h3>
                <p>
                  <strong>For people who care about people</strong>
                  <br />
                  Your group chat isn't a start-up. It's a community, and every
                  community has its own unique needs. So why should you rely on
                  one-sized-fits-all apps made by people who care more about
                  shareholders than stakeholders? Infinitely remixable,
                  small-scale software made for the people you love: that's the
                  vibe.
                </p>

                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#5398c9",
                  }}
                >
                  The App to End all Apps
                </h3>
                <p>
                  <strong>What you need and nothing else</strong>
                  <br />
                  Vibes is every app you could ever need in one place — with no
                  app store, no downloads, and no software updates. It's a tool
                  for building what you need, only when you need it. Share your
                  creations instantly with the group chat and mix them up
                  together. Best of all, everyone's data stays local, portable,
                  and safe.
                </p>
              </DraggableSection>
            </section>

            {/* Section 2: AnimatedScene 0-50 */}
            {/* Section 2: AnimatedScene 0-50 */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              ref={section2Ref}
            >       
              <DraggableSection color="blue" static>
                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#5398c9",
                  }}
                >
                  You're about to make an app
                </h3>
                <p>
                  <strong>The front-end is the fun part</strong>
                  <br />
                  Let's start there. Let's say you want to make a simple counter 
                  that keeps track of the number of times a group of people click 
                  a red button.
                  <br /><br />
                  Most AI models will give you something cool right away.
                </p>
                <div
                  style={{
                    width: "100%",
                    height: "60vh",
                    position: "relative",
                  }}
                >
                  
                  <AnimatedScene progress={0} />
                </div>
                
              </DraggableSection>
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
                  }}
                >
                  Now comes the hard part
                </h3>
                <p>
                  <strong>Multiplayer features need a backend</strong>
                  <br />
                  And backends are hard. You're a vibe coder, not a "DevOps" expert. 
                  Messing this part up is how vibe coded apps get hacked. You can either 
                  try to connect to something like Supabase, which is complicated and expensive.
                  Or let someone build you a backend that you'll be stuck with forever.
                  <br /><br />
                  <strong>Here's the problem</strong>
                  <br />
                  You're trying to vibe code using a web stack that was made for a different problem: 
                  building a huge startup with giant teams of <i>actual</i> programmers using millions
                  in venture capital.
                  <br /><br />
                  <strong>Your web stack wasn't made for vibe coding</strong>
                  <br />
                  Most web stacks are built for mass-market software: big schemas, strict permissions, 
                  endless backend plumbing. Tools like Supabase and row-level auth policies work fine 
                  for enterprise apps — but they slow down small, personal, shareable ones.
                  <br /><br />
                  Vibes DIY takes a different approach. It treats data as part of your creative surface, 
                  not a distant backend. None of this would be possible if you still needed a backend to sync 
                  data between users. But, doesn't everybody need a backend for multiplayer data? 
                  <br /><br />
                                  <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#FEDD00",
                  }}
                >
                  We made a database designed for vibe coding
                </h3>
                  <strong>Fireproof makes the web server into a horseless carriage</strong>
                  <br />
                  Vibes DIY runs on Fireproof, an open source embedded database that syncs without a web server. 
                  It treats data as part of your creative surface, not a corporate cloud service. Fireproof uses 
                  distributed data structures, CRDTs, content-addressed storage, and document-style records
                  to give every app its own lightweight ledger.                  
                </p>
              </DraggableSection>
            </section>

            {/* Section 4: AnimatedScene 50-100 */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              ref={section4Ref}
            >
              
              {/* DraggableSection card for visual reference */}
              <DraggableSection color="yellow" static>
                               <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#FEDD00",
                  }}
                >
                  Back to your counter app...
                </h3> 
                <p>
                  <strong>Now you're using Fireproof + Vibes DIY</strong>
                  <br />
                  Your data lives locally inside your component, syncing when 
                  and where you choose. Conflicts resolve sensibly. State just... 
                  persists.
                  <br /><br />
                  You can build offline, share instantly, and grow 
                  without rewriting your stack. Even if you have no idea what 
                  any of that means and just want to spell out an idea and get an
                   app. We got you.
                  <br /><br />
                </p>
                <div
                  style={{
                    width: "100%",
                    height: "60vh",
                    position: "relative",
                  }}
                ></div>
              </DraggableSection>

              {/* Scrollable AnimatedScene overlay covering full screen */}
              <div
                className="animated-scene-wrapper"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "100vw",
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
                      width: "100vw",
                      height: "100vh",
                    }}
                  >
                    <AnimatedScene progress={animationProgress} />
                  </div>
                </div>
              </div>
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
                  <p>You love your group chat. Meet your group app. </p>
                  <p>
                    Remember that camping trip when nobody packed coffee? The
                    Friendsgiving with six mac n' cheeses and no turkey? You
                    love your friends, but organizing them can be a headache.
                    Make planning painless with custom community apps, made by
                    and for your friends, for everything you do together.
                  </p>
                  <p>
                    Like volunteer sign-ups and school drop-offs. Project
                    checklists and vacation planners. Pick-up basketball
                    schedules and fantasy football rankings. A cooperative chore
                    wheel for the roomies and the ultimate Oscars bracket for
                    movie club. Whatever the vibe, you can build it with Vibes.
                  </p>
                  <p>
                    Share and use your new apps instantly, and remix them on the
                    fly. Everyone's ideas are welcome and everyone's data is
                    protected. This is software that communities build together
                    in real time — to make life easier, fairer, and more fun for
                    everyone.
                  </p>
                  <p>
                    You and your friends aren't users anymore. You're makers.
                  </p>
                </div>
              </DraggableSection>
            </section>

            {/* Section 6: AnimatedScene at 0 (no movement) - Red */}
            <section
              style={{
                ...getSectionWrapperStyle(isMobile),
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              ref={section6Ref}
            >
              {/* DraggableSection card for visual reference */}
              <DraggableSection color="yellow" static>
                <div
                  style={{
                    width: "100%",
                    height: "60vh",
                    position: "relative",
                  }}
                ></div>
              </DraggableSection>

              {/* Scrollable AnimatedScene overlay covering full screen */}
              <div
                className="animated-scene-wrapper"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "100vw",
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
                      width: "100vw",
                      height: "100vh",
                    }}
                  >
                    <AnimatedScene progress={animationProgress} />
                  </div>
                </div>
              </div>
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
                  }}
                >
                  Section 8
                </h3>
                <p>
                  <strong>Content for light section</strong>
                  <br />
                  This is the light section with color oklch(84.6% 0.026 111).
                </p>
              </DraggableSection>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

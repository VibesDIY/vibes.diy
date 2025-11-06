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
  getFirstSectionColorBackgroundStyle,
  getSecondSectionColorBackgroundStyle,
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
} from "./HomeScreen.styles.js";
import {
  ChatAnimation,
  DraggableCard,
  DraggableSection,
  VibesSwitch,
} from "../../components/index.ts";
import { HomeScreenProps } from "./HomeScreen.types.ts";
import { useIsMobile } from "../../hooks/index.ts";
import { AnimatedScene } from "./AnimatedScene.tsx";

export const HomeScreen = ({}: HomeScreenProps) => {
  const isMobile = useIsMobile();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const animatedSceneContainerRef = useRef<HTMLDivElement>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

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

  useEffect(() => {
    if (isMobile) return; // No ejecutar en móvil

    const innerContainer = innerContainerRef.current;
    const chatContainer = chatContainerRef.current;
    const animatedContainer = animatedSceneContainerRef.current;
    if (!innerContainer || !chatContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if the scroll event is happening inside the animated scene container
      const isInsideAnimatedScene = animatedContainer && animatedContainer.contains(e.target as Node);

      if (isInsideAnimatedScene && animatedContainer) {
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
            const scrollProgress = scrollHeight > clientHeight
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
            const scrollProgress = scrollHeight > clientHeight
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



  return (
    <div style={getBlackBorderWrapper()}>
      <div style={getBackgroundStyle()} />
      <div style={getNoiseTextureStyle()} />
      <div style={getBlackBorderInnerWrapper()}>
        <div style={getMenuStyle()}>
          <VibesSwitch size={64} />
        </div>

        <div style={getScrollingBackgroundsStyle()}>
          <div style={getFirstSectionColorBackgroundStyle(isMobile)} />
          <div style={getSecondSectionColorBackgroundStyle(isMobile)} />
        </div>

        <div style={getWrapperStyle()} />

        <div style={getContainerStyle()}>
          <div style={getInnerContainerStyle(isMobile)} ref={innerContainerRef}>
            <DraggableSection color="grey" x={20} y={20}>
              <h2 style={{ fontWeight: "bold", fontSize: "40px" }}>
                Impress the Group Chat
              </h2>
              <p style={{ fontWeight: "bold" }}>
                Instantly make your own apps on the fly
              </p>
            </DraggableSection>

            {isMobile && <DraggableSection color="blue" x={20} y={170}>
              <ChatAnimation
                title={selectedScenario.title}
                arrayOfMessages={selectedScenario.arrayOfMessages}
                user={"You"}
              />
            </DraggableSection>}

            <DraggableCard color="blue" x={550} y={100}>
              <p style={{ maxWidth: "250px", fontWeight: "bold" }}>
                No coding experience required. Just build what you need, when
                you need it, and share it instantly with the group chat.
              </p>
            </DraggableCard>

            <DraggableCard color="grey" x={870} y={100}>
              <img
                src="https://media.discordapp.net/attachments/1423771251461324800/1432508556044931102/computer-anim.gif?ex=690b324e&is=6909e0ce&hm=7d59f9a19b55fae0b9e829cef4a6f2df006e38a056061ed1b3d6b89f0265ee0c&=&width=1472&height=1112"
                style={{ width: "150px" }}
              />
            </DraggableCard>

            <DraggableCard color="yellow" x={800} y={20}>
              <p style={{ fontWeight: "bold" }}>No app store. No downloads.</p>
            </DraggableCard>

            <DraggableCard color="red" x={800} y={320}>
              <p style={{ maxWidth: "200px", fontWeight: "bold" }}>
                Custom community apps. Made by and for your friends, for
                everything you do together.
              </p>
            </DraggableCard>
            {!isMobile && <div
              className="chat-container-wrapper"
              style={getChatContainerStyleOut()}
            >
              <div
                className="chat-inner"
                style={getChatContainerStyle()}
              >
                <div>
                  <div style={getChatContainerTopBar()} />
                  <div style={getChatContainerBottomCard()}
                ref={chatContainerRef}>
                    {selectedScenario.title && (
                      <div style={getTitleStyle()}>{selectedScenario.title}</div>
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
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>}

            {!isMobile && <div
              className="animated-scene-wrapper"
              style={{
                position: "absolute",
                left: 0,
                top: "250vh",
                width: "100%",
                height: "100vh",
                overflowY: "auto",
                overflowX: "hidden",
                background: "transparent",
                zIndex: 10,
                marginBottom: "100vh",
              }}
              ref={animatedSceneContainerRef}
            >
              <div style={{ height: "200vh" }}>
                <div style={{
                  position: "sticky",
                  top: 0,
                  width: "100%",
                  height: "100vh"
                }}>
                  <AnimatedScene progress={animationProgress} />
                </div>
              </div>
            </div>}
          </div>

          <div style={getSectionsContainerStyle(isMobile)}>
            <section style={getSectionWrapperStyle(isMobile)}>
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

                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#5398c9",
                  }}
                >
                  Get off the Cloud
                </h3>
                <p>
                  <strong>With un-hackable architecture</strong>
                  <br />
                  Vibes gives you complete visibility and control over your
                  data. Your community apps are stored locally, right on your
                  phone — so you don't have to worry about trusting everyone's
                  personal information to some impersonal cloud.
                </p>

                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#5398c9",
                  }}
                >
                  Single-Serving Software
                </h3>
                <p>
                  <strong>Don't overthink it — make it.</strong>
                  <br />
                  No need to be precious. Whip up a one-time scoring app for
                  your annual pumpkin carving contest. Generate questions for
                  trivia night. Troll your friends with a custom meme template.
                  Solve small problems or big ones. Make new things and put them
                  into motion right away. As long as you can describe it, you
                  can build it — fast.
                </p>

                <h3
                  style={{
                    fontWeight: "bold",
                    fontSize: "40px",
                    color: "#5398c9",
                  }}
                >
                  Quick Apps for Lasting Community
                </h3>
                <p>
                  <strong>Because good software makes good neighbors</strong>
                  <br />
                  Your relationships are always evolving. Your tools should too.
                  With Vibes, build exactly what your community needs right now.
                  When those tools don't serve you anymore, make some new ones.
                  Because it's not about the apps. It's about what you do with
                  them together.
                </p>
              </DraggableSection>
            </section>

            <section style={getSectionWrapperStyle(isMobile)}>
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
          </div>
        </div>
      </div>
    </div>
  );
};

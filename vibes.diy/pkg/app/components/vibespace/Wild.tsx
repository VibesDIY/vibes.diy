import type { ReactElement, CSSProperties } from "react";
import React, { useState, useEffect, useRef } from "react";

// Define the CSS keyframes and animations
const wildStyles = {
  "@keyframes shine": {
    "100%": {
      transform: "translateX(100%)",
    },
  },
  "@keyframes colorShift": {
    "0%": {
      color: "rgba(245, 158, 11, 1)",
    },
    "50%": {
      color: "rgba(249, 115, 22, 1)",
    },
    "100%": {
      color: "rgba(245, 158, 11, 1)",
    },
  },
  shineEffect: {
    animation: "shine 1.5s infinite",
    animationTimingFunction: "ease-in-out",
  } as CSSProperties,
};

// Define the structure of vibe documents
interface VibeDocument {
  _id: string;
  title?: string;
  slug?: string;
  publishedUrl?: string;
  favorite?: boolean;
}

interface BasicVibespaceProps {
  userId: string;
  vibes: VibeDocument[];
  isLoading: boolean;
}

export default function Wild({
  userId,
  vibes,
  isLoading,
}: BasicVibespaceProps): ReactElement {
  // Create a style element for our keyframe animations
  useEffect(() => {
    // Add keyframe animations to the document
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes shine {
        100% { transform: translateX(100%); }
      }
      @keyframes colorShift {
        0% { color: rgba(245, 158, 11, 1); }
        50% { color: rgba(249, 115, 22, 1); }
        100% { color: rgba(245, 158, 11, 1); }
      }
      @keyframes floatUp {
        0% { transform: translateY(0) rotate(0); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 0.8; }
        100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
      }
      .animate-shine {
        animation: shine 1.5s infinite;
      }
      .float-particle {
        position: absolute;
        pointer-events: none;
        animation: floatUp 15s ease-in infinite;
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<
    {
      id: number;
      x: number;
      y: number;
      emoji: string;
      size: number;
      speed: number;
    }[]
  >([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Random jungle emojis
  const jungleEmojis = [
    "🐯",
    "🦁",
    "🐘",
    "🦓",
    "🦒",
    "🦍",
    "🐆",
    "🐊",
    "🦜",
    "🐒",
    "🌴",
    "🌺",
    "🍌",
    "🥥",
  ];

  // Create floating emojis periodically
  useEffect(() => {
    const addEmoji = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setFloatingEmojis((prev) => {
          // Keep only the last 15 emojis to prevent too many elements
          const limited =
            prev.length > 15 ? prev.slice(prev.length - 15) : prev;
          return [
            ...limited,
            {
              id: Date.now(),
              x: Math.random() * containerWidth,
              y: -50,
              emoji:
                jungleEmojis[Math.floor(Math.random() * jungleEmojis.length)],
              size: 20 + Math.random() * 30,
              speed: 1 + Math.random() * 3,
            },
          ];
        });
      }
    };

    const interval = setInterval(addEmoji, 2000);
    return () => clearInterval(interval);
  }, []);

  // Animate the floating emojis
  useEffect(() => {
    if (floatingEmojis.length === 0) return;

    const animateEmojis = () => {
      setFloatingEmojis(
        (prev) =>
          prev
            .map((emoji) => {
              const newY = emoji.y + emoji.speed;
              // Remove emojis that have gone off screen by not including them
              if (newY > window.innerHeight) return null;
              return { ...emoji, y: newY };
            })
            .filter(Boolean) as typeof floatingEmojis,
      );
    };

    const animationId = requestAnimationFrame(animateEmojis);
    return () => cancelAnimationFrame(animationId);
  }, [floatingEmojis]);

  // Create a pulsing effect for the title
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Rotating background effect
  useEffect(() => {
    const rotateInterval = setInterval(() => {
      setRotation((prev) => (prev + 1) % 360);
    }, 100);
    return () => clearInterval(rotateInterval);
  }, []);

  // Handle mouse movement for interactive background
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const { left, top, width, height } =
      containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top) / height;

    containerRef.current.style.setProperty("--mouse-x", `${x}`);
    containerRef.current.style.setProperty("--mouse-y", `${y}`);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative container mx-auto overflow-hidden p-4"
      style={{
        minHeight: "80vh",
        background: `radial-gradient(circle at calc(var(--mouse-x, 0.5) * 100%) calc(var(--mouse-y, 0.5) * 100%), 
                                rgba(255, 165, 0, 0.4), 
                                rgba(255, 69, 0, 0.2), 
                                rgba(139, 69, 19, 0.4))`,
        boxShadow: "inset 0 0 50px rgba(255, 165, 0, 0.3)",
        borderRadius: "20px",
      }}
    >
      {/* Particle effects */}
      {[...Array(15)].map((_, i) => (
        <div
          key={`particle-${i}`}
          className="float-particle"
          style={{
            left: `${5 + Math.random() * 90}%`,
            bottom: "-20px",
            width: `${3 + Math.random() * 8}px`,
            height: `${3 + Math.random() * 8}px`,
            borderRadius: "50%",
            background: `rgba(${255 - Math.random() * 30}, ${165 - Math.random() * 30}, ${Math.random() * 20}, ${0.4 + Math.random() * 0.4})`,
            boxShadow: "0 0 10px 2px rgba(255, 165, 0, 0.3)",
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${10 + Math.random() * 15}s`,
          }}
        />
      ))}

      {/* Floating emojis */}
      {floatingEmojis.map((emoji) => (
        <div
          key={emoji.id}
          className="pointer-events-none absolute animate-bounce select-none"
          style={{
            left: `${emoji.x}px`,
            top: `${emoji.y}px`,
            fontSize: `${emoji.size}px`,
            opacity: 0.7,
            transform: `rotate(${Math.sin(emoji.y / 50) * 30}deg)`,
            filter: "drop-shadow(0 0 5px rgba(255,255,255,0.5))",
          }}
        >
          {emoji.emoji}
        </div>
      ))}

      {/* Background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(${rotation}deg, rgba(255,215,0,0.1) 0px, rgba(255,165,0,0.1) 20px, transparent 20px, transparent 40px)`,
        }}
      />

      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-between">
          <div
            className={`transform transition-all duration-700 ${pulse ? "scale-110 rotate-1" : "scale-100 -rotate-1"}`}
            style={{
              filter: pulse
                ? "drop-shadow(0 0 15px rgba(255,165,0,0.8))"
                : "drop-shadow(0 0 5px rgba(255,165,0,0.3))",
            }}
          >
            <h2
              className="mb-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-4xl font-extrabold text-transparent"
              style={{
                letterSpacing: "0.05em",
                textShadow: "0 0 8px rgba(255,165,0,0.7)",
                animation: "colorShift 3s infinite",
                WebkitBackgroundClip: "text",
                backgroundSize: "200% 200%",
                backgroundPosition: pulse ? "left center" : "right center",
                transition: "background-position 1.5s ease",
              }}
            >
              <span className="inline-block animate-bounce">🐯</span> Wild
              Space: {userId}{" "}
              <span className="inline-block animate-bounce delay-150">🐯</span>
            </h2>
            <p
              className="mb-6 animate-pulse font-semibold tracking-wider text-amber-500"
              style={{
                textShadow: "0 0 8px rgba(255,69,0,0.7)",
                letterSpacing: "0.1em",
              }}
            >
              <span className="animate-pulse">✨</span> Unleash the wild vibes
              in this jungle space <span className="animate-pulse">✨</span>
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-b-4 border-orange-500 border-r-transparent border-l-transparent"></div>
              <div className="absolute inset-0 h-16 w-16 animate-ping rounded-full border-4 border-yellow-400 opacity-30 delay-150"></div>
              <div
                className="absolute top-4 left-4 h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-yellow-300 border-r-transparent border-l-transparent"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "1s",
                }}
              ></div>
            </div>
          </div>
        ) : vibes.length === 0 ? (
          <div className="transform rounded-md border-2 border-yellow-500/50 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 py-8 text-center shadow-lg shadow-orange-500/20 backdrop-blur-sm transition-all duration-300 hover:scale-105">
            <p className="mb-4 text-2xl font-bold text-amber-500">
              🏝️ No wild vibes found in this jungle space 🏝️
            </p>
            <p className="animate-pulse text-lg text-amber-400">
              Time to go on a safari and catch some!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vibes.map((doc, index) => (
              <div
                key={doc._id}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                className="group relative overflow-hidden rounded-xl p-5 transition-all hover:shadow-xl"
                style={{
                  transform:
                    hoverIndex === index
                      ? "scale(1.05) rotate(1deg)"
                      : "scale(1) rotate(0deg)",
                  transition:
                    "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  background: `linear-gradient(135deg, 
                              ${doc.favorite ? "rgba(255,215,0,0.25)" : "rgba(255,140,0,0.15)"}, 
                              ${doc.favorite ? "rgba(255,165,0,0.35)" : "rgba(139,69,19,0.25)"})`,
                  border: `2px solid ${doc.favorite ? "rgba(255,215,0,0.5)" : "rgba(255,140,0,0.3)"}`,
                  boxShadow:
                    hoverIndex === index
                      ? "0 20px 25px -5px rgba(255, 165, 0, 0.3), 0 10px 10px -5px rgba(255, 69, 0, 0.2)"
                      : "0 4px 6px -1px rgba(255, 165, 0, 0.1), 0 2px 4px -1px rgba(255, 69, 0, 0.06)",
                }}
              >
                {/* Background pattern unique to each card */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-500 group-hover:opacity-30"
                  style={{
                    backgroundImage: `repeating-linear-gradient(${(index * 45) % 360}deg, 
                                    rgba(255,165,0,0.1) 0px, 
                                    rgba(255,69,0,0.1) 10px, 
                                    transparent 10px, 
                                    transparent 20px)`,
                  }}
                />

                <div className="relative z-10 mb-2 flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight">
                    <span className="relative">
                      <span
                        className={`absolute top-0 -left-6 transition-all duration-300 ${hoverIndex === index ? "-translate-y-1 rotate-12 opacity-100" : "translate-y-0 opacity-0"}`}
                      >
                        {doc.favorite ? "⭐" : "🌟"}
                      </span>
                      <span
                        className="relative inline-block bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent"
                        style={{
                          textShadow:
                            hoverIndex === index
                              ? "0 0 8px rgba(255,165,0,0.4)"
                              : "none",
                        }}
                      >
                        {doc.title || doc._id}
                      </span>
                    </span>
                  </h3>
                </div>

                {doc.publishedUrl && (
                  <div className="relative mt-3 mb-4 overflow-hidden rounded-lg transition-all duration-500 group-hover:shadow-xl">
                    {/* Blurred background version */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      <img
                        src={`${doc.publishedUrl}/screenshot.png`}
                        className="h-full w-full scale-110 object-cover"
                        alt=""
                        style={{
                          filter: "blur(10px)",
                          opacity: 0.9,
                          border: "2px solid rgba(255,140,0,0.3)",
                        }}
                        loading="lazy"
                      />
                    </div>

                    {/* Gradient overlay */}
                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent to-orange-600/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                    {/* Foreground image with variable height */}
                    <div className="relative z-10 flex w-full justify-center py-2">
                      <img
                        src={`${doc.publishedUrl}/screenshot.png`}
                        alt={`Screenshot from ${doc.title || doc._id}`}
                        className="max-w-full rounded-lg object-contain transition-transform duration-700 group-hover:scale-105"
                        style={{
                          maxHeight: "16rem",
                          border: "2px solid rgba(255,140,0,0.3)",
                          boxShadow: "inset 0 0 10px rgba(255,140,0,0.2)",
                        }}
                        loading="lazy"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex space-x-3">
                  <div className="flex-grow"></div>

                  {doc.slug && (
                    <a
                      href={`/remix/${doc.slug}`}
                      className="relative overflow-hidden rounded-md bg-gradient-to-r from-amber-200 to-yellow-200 px-4 py-2 text-sm font-medium text-amber-700 transition-all duration-300 hover:-translate-y-1 hover:from-amber-300 hover:to-yellow-300 hover:shadow-md hover:shadow-amber-500/30"
                    >
                      <span className="relative z-10 flex items-center gap-1">
                        <span className="animate-pulse">🔄</span> Remix
                      </span>
                      <span
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-amber-300/0 via-amber-300/30 to-amber-300/0"
                        style={
                          hoverIndex === index ? wildStyles.shineEffect : {}
                        }
                      ></span>
                    </a>
                  )}

                  {doc.publishedUrl && (
                    <a
                      href={doc.publishedUrl}
                      className="relative overflow-hidden rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-1 hover:from-orange-600 hover:to-amber-600 hover:shadow-md hover:shadow-orange-500/30"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="relative z-10 flex items-center gap-1">
                        <span className="animate-pulse">🔥</span> View Live
                      </span>
                      <span
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-yellow-300/0 via-yellow-300/20 to-yellow-300/0"
                        style={
                          hoverIndex === index ? wildStyles.shineEffect : {}
                        }
                      ></span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

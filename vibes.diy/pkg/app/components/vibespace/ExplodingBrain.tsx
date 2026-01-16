import type { ReactElement } from "react";
import React, { useState, useEffect, useRef } from "react";

// Define the structure of vibe documents
interface VibeDocument {
  _id: string;
  title?: string;
  slug?: string;
  publishedUrl?: string;
  favorite?: boolean;
}

interface ExplodingBrainProps {
  userId: string;
  vibes: VibeDocument[];
  isLoading: boolean;
}

// Brain levels for the meme effect
interface BrainLevel {
  name: string;
  color: string;
  glow: string;
}

const BRAIN_LEVELS: BrainLevel[] = [
  {
    name: "Basic Brain",
    color: "blue-400",
    glow: "0 0 15px rgba(59, 130, 246, 0.7)",
  },
  {
    name: "Enhanced Brain",
    color: "indigo-500",
    glow: "0 0 25px rgba(99, 102, 241, 0.8)",
  },
  {
    name: "Expanding Brain",
    color: "purple-600",
    glow: "0 0 35px rgba(147, 51, 234, 0.9)",
  },
  {
    name: "Cosmic Brain",
    color: "pink-500",
    glow: "0 0 45px rgba(236, 72, 153, 1)",
  },
];

export default function ExplodingBrain({
  userId,
  vibes,
  isLoading,
}: ExplodingBrainProps): ReactElement {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [brainLevel, setBrainLevel] = useState(0);
  const [brainPulse, setBrainPulse] = useState(false);
  const [neuronLines, setNeuronLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; color: string }[]
  >([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add keyframes for the brain animation
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes brainPulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.05); opacity: 1; }
        100% { transform: scale(1); opacity: 0.8; }
      }
      
      @keyframes neuronFiring {
        0% { stroke-dashoffset: 1000; opacity: 0.1; }
        50% { opacity: 0.8; }
        100% { stroke-dashoffset: 0; opacity: 0.1; }
      }
      
      @keyframes enlightenment {
        0% { transform: translateY(0) scale(1) rotate(0deg); }
        50% { transform: translateY(-10px) scale(1.2) rotate(5deg); }
        100% { transform: translateY(0) scale(1) rotate(0deg); }
      }
      
      @keyframes float {
        0% { transform: translateY(0) translateX(0); }
        25% { transform: translateY(-5px) translateX(5px); }
        50% { transform: translateY(0) translateX(10px); }
        75% { transform: translateY(5px) translateX(5px); }
        100% { transform: translateY(0) translateX(0); }
      }
      
      @keyframes expand {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes bgPulse {
        0% { transform: scale(1.1) rotate(0deg); }
        33% { transform: scale(1.15) rotate(-1deg); }
        66% { transform: scale(1.2) rotate(1deg); }
        100% { transform: scale(1.1) rotate(0deg); }
      }
      
      @keyframes frontPulse {
        0% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.02) rotate(-0.5deg); }
        50% { transform: scale(1.05) rotate(0.5deg); }
        75% { transform: scale(1.02) rotate(0deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Generate neuron lines
  useEffect(() => {
    if (!containerRef.current) return;

    const generateNeuronLines = () => {
      const width = containerRef.current?.offsetWidth || 800;
      const height = containerRef.current?.offsetHeight || 600;

      const newLines = Array.from({ length: 15 }, () => {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = Math.random() * width;
        const y2 = Math.random() * height;
        const colorIndex = Math.floor(Math.random() * BRAIN_LEVELS.length);

        return {
          x1,
          y1,
          x2,
          y2,
          color: BRAIN_LEVELS[colorIndex].color,
        };
      });

      setNeuronLines(newLines);
    };

    generateNeuronLines();
    const interval = setInterval(generateNeuronLines, 5000);

    return () => clearInterval(interval);
  }, []);

  // Cycle through brain levels
  useEffect(() => {
    const interval = setInterval(() => {
      setBrainLevel((prev) => (prev + 1) % BRAIN_LEVELS.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Pulse effect for the brain
  useEffect(() => {
    const interval = setInterval(() => {
      setBrainPulse((prev) => !prev);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Calculate the brain level for a specific vibe based on its index
  const getVibeLevel = (index: number) => {
    return index % BRAIN_LEVELS.length;
  };

  // Get the appropriate title based on the current brain level
  const getBrainTitle = () => {
    switch (brainLevel) {
      case 0:
        return `Regular Vibespace: ${userId}`;
      case 1:
        return `Enhanced Vibespace: ${userId}`;
      case 2:
        return `Enlightened Vibespace: ${userId}`;
      case 3:
        return `COSMIC VIBESPACE: ${userId}`;
      default:
        return `Vibespace: ${userId}`;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative container mx-auto min-h-[80vh] overflow-hidden rounded-2xl p-4"
      style={{
        background: `radial-gradient(circle at center, 
                    rgba(99, 102, 241, 0.3), 
                    rgba(79, 70, 229, 0.2), 
                    rgba(67, 56, 202, 0.1))`,
        boxShadow: `inset 0 0 100px ${BRAIN_LEVELS[brainLevel].glow}`,
      }}
    >
      {/* Neuron lines */}
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full">
        {neuronLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className={`stroke-${line.color}`}
            style={{
              strokeWidth: "1px",
              opacity: 0.4,
              strokeDasharray: "10",
              animation: `neuronFiring ${3 + Math.random() * 5}s linear infinite`,
            }}
          />
        ))}
      </svg>

      {/* Brain icon */}
      <div
        className={`absolute top-10 right-10 text-6xl transition-all duration-1000 ${brainPulse ? "scale-110" : "scale-100"}`}
        style={{
          filter: `drop-shadow(0 0 10px ${BRAIN_LEVELS[brainLevel].glow})`,
          animation: "float 5s ease-in-out infinite",
        }}
      >
        🧠
      </div>

      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-between">
          <div
            className="transition-all duration-1000"
            style={{
              animation:
                brainLevel === 3
                  ? "enlightenment 3s ease-in-out infinite"
                  : undefined,
            }}
          >
            <h2
              className={`mb-4 bg-gradient-to-r bg-clip-text text-4xl font-extrabold text-transparent from-${BRAIN_LEVELS[brainLevel].color} to-${BRAIN_LEVELS[(brainLevel + 1) % 4].color}`}
              style={{
                textShadow: BRAIN_LEVELS[brainLevel].glow,
                letterSpacing: "0.05em",
                animation: "brainPulse 2s ease-in-out infinite",
              }}
            >
              {getBrainTitle()}
            </h2>
            <p
              className={`mb-6 font-semibold tracking-wide text-${BRAIN_LEVELS[brainLevel].color}`}
              style={{
                opacity: 0.9,
                textShadow: BRAIN_LEVELS[brainLevel].glow,
              }}
            >
              {brainLevel === 0 && "Browse your vibes like a normal person"}
              {brainLevel === 1 &&
                "Discovering new neural pathways through your vibespace"}
              {brainLevel === 2 &&
                "Transcending the ordinary limitations of vibespace perception"}
              {brainLevel === 3 &&
                "ACHIEVING VIBESPACE CONSCIOUSNESS BEYOND MORTAL COMPREHENSION"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="relative">
              <div
                className={`h-16 w-16 animate-spin rounded-full border-t-4 border-b-4 border-${BRAIN_LEVELS[brainLevel].color}`}
                style={{
                  borderRightColor: "transparent",
                  borderLeftColor: "transparent",
                  boxShadow: BRAIN_LEVELS[brainLevel].glow,
                }}
              ></div>
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-2xl"
                style={{
                  animation: "brainPulse 1s ease-in-out infinite",
                }}
              >
                🧠
              </div>
            </div>
          </div>
        ) : vibes.length === 0 ? (
          <div
            className={`rounded-xl bg-gradient-to-r py-10 text-center from-${BRAIN_LEVELS[brainLevel].color}/20 to-${BRAIN_LEVELS[(brainLevel + 1) % 4].color}/20 border-2 border-${BRAIN_LEVELS[brainLevel].color}/50`}
            style={{
              boxShadow: `0 0 20px ${BRAIN_LEVELS[brainLevel].glow}`,
              animation: "expand 3s ease-in-out infinite",
            }}
          >
            <p
              className={`text-2xl font-bold text-${BRAIN_LEVELS[brainLevel].color} mb-4`}
            >
              {brainLevel < 2
                ? "No vibes found in this space"
                : "YOUR MIND IS A BLANK CANVAS AWAITING CREATION"}
            </p>
            <div className="animate-pulse text-6xl">🧠</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vibes.map((doc, index) => {
              const vibeLevel = getVibeLevel(index);
              const brainColor = BRAIN_LEVELS[vibeLevel].color;

              return (
                <div
                  key={doc._id}
                  onMouseEnter={() => setHoverIndex(index)}
                  onMouseLeave={() => setHoverIndex(null)}
                  className={`group relative overflow-hidden rounded-xl p-5 transition-all duration-500`}
                  style={{
                    background: `linear-gradient(135deg, rgba(${vibeLevel * 50}, ${70 + vibeLevel * 30}, ${200 - vibeLevel * 30}, 0.15), rgba(${vibeLevel * 60}, ${60 + vibeLevel * 40}, ${180 - vibeLevel * 30}, 0.25))`,
                    borderWidth: "2px",
                    borderStyle: "solid",
                    borderColor: `rgba(${vibeLevel * 50}, ${70 + vibeLevel * 30}, ${200 - vibeLevel * 30}, 0.5)`,
                    boxShadow:
                      hoverIndex === index
                        ? `0 0 30px ${BRAIN_LEVELS[vibeLevel].glow}`
                        : `0 0 10px ${BRAIN_LEVELS[vibeLevel].glow}`,
                    transform:
                      hoverIndex === index
                        ? "translateY(-10px) scale(1.03)"
                        : "translateY(0) scale(1)",
                  }}
                >
                  {/* Brain level icon */}
                  <div
                    className={`absolute top-3 right-3 transition-all duration-300 opacity-${hoverIndex === index ? "100" : "70"}`}
                    style={{
                      filter: `drop-shadow(0 0 5px ${BRAIN_LEVELS[vibeLevel].glow})`,
                      transform:
                        hoverIndex === index ? "scale(1.2)" : "scale(1)",
                    }}
                  >
                    {vibeLevel === 0 && "🧠"}
                    {vibeLevel === 1 && "✨🧠"}
                    {vibeLevel === 2 && "🔮🧠✨"}
                    {vibeLevel === 3 && "🌌🧠🌠"}
                  </div>

                  <div className="relative z-10 mb-2 flex items-center justify-between">
                    <h3
                      className={`text-xl font-bold tracking-tight text-${brainColor}`}
                      style={{
                        textShadow:
                          vibeLevel > 1
                            ? `0 0 5px ${BRAIN_LEVELS[vibeLevel].glow}`
                            : "none",
                      }}
                    >
                      {doc.title || doc._id}
                    </h3>
                  </div>

                  {doc.publishedUrl && (
                    <div className="relative mt-3 mb-4 overflow-hidden rounded-lg transition-all duration-500 group-hover:shadow-xl">
                      {/* Blurred background version with animation */}
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
                        <img
                          src={`${doc.publishedUrl}/screenshot.png`}
                          className="h-full w-full object-cover"
                          alt=""
                          style={{
                            filter: `blur(10px) hue-rotate(${vibeLevel * 15}deg)`,
                            opacity: 0.9,
                            borderWidth: "2px",
                            borderStyle: "solid",
                            borderColor: `rgba(${vibeLevel * 50}, ${70 + vibeLevel * 30}, ${200 - vibeLevel * 30}, 0.3)`,
                            animation: `bgPulse ${4 + vibeLevel}s infinite ease-in-out`,
                            transformOrigin: "center",
                          }}
                          loading="lazy"
                        />
                      </div>

                      {/* Gradient overlay */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-b from-transparent to-${brainColor}/30 pointer-events-none z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                      ></div>

                      {/* Foreground image with variable height and animation */}
                      <div className="relative z-10 flex w-full justify-center py-2">
                        <img
                          src={`${doc.publishedUrl}/screenshot.png`}
                          alt={`Screenshot from ${doc.title || doc._id}`}
                          className="max-w-full rounded-lg object-contain transition-transform duration-700 group-hover:scale-105"
                          style={{
                            maxHeight: "16rem",
                            borderWidth: "2px",
                            borderStyle: "solid",
                            borderColor: `rgba(${vibeLevel * 50}, ${70 + vibeLevel * 30}, ${200 - vibeLevel * 30}, 0.3)`,
                            boxShadow: `inset 0 0 10px rgba(${vibeLevel * 50}, ${70 + vibeLevel * 30}, ${200 - vibeLevel * 30}, 0.2)`,
                            animation: `frontPulse ${3 + vibeLevel * 0.5}s infinite ease-in-out`,
                            animationDelay: "0.5s",
                            transformOrigin: "center",
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
                        className={`relative overflow-hidden font-medium text-${brainColor} bg-${brainColor}/20 hover:bg-${brainColor}/30 rounded-md px-4 py-2 text-sm transition-all duration-300`}
                        style={{
                          boxShadow:
                            vibeLevel > 1
                              ? `0 0 10px ${BRAIN_LEVELS[vibeLevel].glow}`
                              : "none",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-1">
                          {vibeLevel < 2 ? "🔄" : "🧠"} Remix
                        </span>
                      </a>
                    )}

                    {doc.publishedUrl && (
                      <a
                        href={doc.publishedUrl}
                        className={`relative overflow-hidden font-medium text-white bg-${brainColor} hover:bg-${brainColor}/80 rounded-md px-4 py-2 text-sm transition-all duration-300`}
                        style={{
                          boxShadow: `0 0 ${5 + vibeLevel * 5}px ${BRAIN_LEVELS[vibeLevel].glow}`,
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="relative z-10 flex items-center gap-1">
                          {vibeLevel === 0 && "👁️ View"}
                          {vibeLevel === 1 && "👁️✨ View"}
                          {vibeLevel === 2 && "👁️✨ EXPERIENCE"}
                          {vibeLevel === 3 && "🌌 TRANSCEND"}
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

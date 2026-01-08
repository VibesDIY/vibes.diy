import React, { ReactElement, useState, useEffect, useRef } from "react";

// Cyberpunk color palette and neon effects
const NEONS = [
  "#ff00cc",
  "#00ffff",
  "#39ff14",
  "#fffb00",
  "#ff3131",
  "#00ffea",
  "#ff00ff",
  "#fffb00",
  "#00ffea",
];

interface VibeDocument {
  _id: string;
  title?: string;
  slug?: string;
  publishedUrl?: string;
  favorite?: boolean;
}

interface CyberpunkProps {
  userId: string;
  vibes: VibeDocument[];
  isLoading: boolean;
}

export default function Cyberpunk({
  userId,
  vibes,
  isLoading,
}: CyberpunkProps): ReactElement {
  const [glitch, setGlitch] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [scanY, setScanY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch((g) => !g);
      setBgIndex((i) => (i + 1) % NEONS.length);
      setScanY((y) => (y + 7) % 100);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Insert cyberpunk keyframes
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes scan {
        0% { opacity: 0.1; }
        50% { opacity: 0.7; }
        100% { opacity: 0.1; }
      }
      @keyframes flicker {
        0%, 100% { opacity: 1; }
        10% { opacity: 0.7; }
        20% { opacity: 0.3; }
        35% { opacity: 0.9; }
        50% { opacity: 0.6; }
        75% { opacity: 1; }
      }
      @keyframes glitch {
        0% { transform: none; }
        20% { transform: translateX(-2px) skewX(5deg); }
        25% { transform: translateX(2px) skewX(-5deg); }
        30% { transform: translateX(-5px) skewX(3deg); }
        35% { transform: translateX(3px) skewX(-3deg); }
        40% { transform: none; }
      }
      @keyframes hue {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative container mx-auto min-h-[80vh] overflow-hidden p-4"
      style={{
        background: `repeating-linear-gradient(120deg, ${NEONS[bgIndex]}10 0 2px, transparent 2px 40px)`,
        boxShadow: `0 0 100px 20px ${NEONS[bgIndex]}99, 0 0 400px 10px #000 inset`,
        filter: "contrast(1.6) brightness(0.9)",
        border: `3px double ${NEONS[(bgIndex + 2) % NEONS.length]}`,
        borderRadius: "22px",
        animation: "hue 10s linear infinite",
      }}
    >
      {/* CRT scanline effect */}
      <div
        className="pointer-events-none absolute left-0 z-50 h-10 w-full"
        style={{
          top: `${scanY}%`,
          background: `linear-gradient(0deg, transparent 0%, ${NEONS[bgIndex]}44 50%, transparent 100%)`,
          animation: "scan 1.5s linear infinite",
          mixBlendMode: "screen",
        }}
      />
      {/* Glitchy header */}
      <h2
        className="relative z-10 text-center text-5xl font-black tracking-widest uppercase select-none"
        style={{
          color: NEONS[bgIndex],
          textShadow: `0 0 8px ${NEONS[bgIndex]}, 0 0 32px #fff, 0 0 2px #fff`,
          animation: glitch ? "glitch 0.3s infinite" : "flicker 1.2s infinite",
          letterSpacing: "0.25em",
          filter: "contrast(2) saturate(2) blur(0.5px)",
        }}
      >
        CYBERPUNK VIBESPACE
      </h2>
      <div className="mt-2 mb-8 flex justify-center">
        <span
          className="rounded-full border px-4 py-1 font-mono text-sm"
          style={{
            color: NEONS[(bgIndex + 3) % NEONS.length],
            borderColor: NEONS[(bgIndex + 2) % NEONS.length],
            background: `${NEONS[(bgIndex + 1) % NEONS.length]}22`,
            textShadow: `0 0 6px ${NEONS[(bgIndex + 1) % NEONS.length]}`,
            filter: "blur(0.2px)",
            animation: "flicker 2s infinite",
          }}
        >
          USER: <span className="tracking-widest">{userId}</span>
        </span>
      </div>
      {/* Glitchy vibes grid */}
      <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex h-40 items-center justify-center">
            <span
              className="animate-pulse text-4xl"
              style={{ color: NEONS[bgIndex] }}
            >
              LOADING…
            </span>
          </div>
        ) : vibes.length === 0 ? (
          <div
            className="col-span-full py-24 text-center text-3xl font-bold tracking-widest"
            style={{
              color: NEONS[bgIndex],
              textShadow: `0 0 12px ${NEONS[bgIndex]}`,
            }}
          >
            NO VIBES FOUND
            <br />
            <span className="text-base opacity-80">
              (404 CYBERSPACE NOT FOUND)
            </span>
          </div>
        ) : (
          vibes.map((doc, i) => (
            <div
              key={doc._id}
              className="group relative overflow-hidden rounded-xl border-2 p-6"
              style={{
                borderColor: NEONS[i % NEONS.length],
                background: `linear-gradient(120deg, #090a1a 60%, ${NEONS[i % NEONS.length]}22 100%)`,
                boxShadow: `0 0 45px 5px ${NEONS[i % NEONS.length]}66, 0 0 2px #fff`,
                filter: "blur(0.2px) contrast(1.2)",
                animation: glitch ? "glitch 0.2s infinite" : "none",
              }}
            >
              <div
                className="pointer-events-none absolute -top-2 -left-2 text-2xl select-none"
                style={{
                  color: NEONS[(i + 1) % NEONS.length],
                  textShadow: `0 0 12px ${NEONS[(i + 1) % NEONS.length]}`,
                }}
              >
                ░▒▓█
              </div>
              <h3
                className="mb-3 text-2xl font-extrabold tracking-widest uppercase select-none"
                style={{
                  color: NEONS[(i + 2) % NEONS.length],
                  textShadow: `0 0 8px ${NEONS[(i + 2) % NEONS.length]}, 0 0 2px #fff`,
                  letterSpacing: "0.15em",
                  filter: "contrast(2) blur(0.5px)",
                  animation: "flicker 2s infinite",
                }}
              >
                {doc.title || doc._id}
              </h3>
              {doc.publishedUrl && (
                <div
                  className="relative mt-3 mb-4 overflow-hidden rounded-xl"
                  style={{
                    boxShadow: `0 0 15px 1px ${NEONS[(i + 3) % NEONS.length]}`,
                    border: `1px solid ${NEONS[(i + 4) % NEONS.length]}44`,
                  }}
                >
                  {/* Extremely blurred cyberpunk background */}
                  <div className="absolute inset-0 z-0 overflow-hidden">
                    <img
                      src={`${doc.publishedUrl}/screenshot.png`}
                      className="h-full w-full scale-110 object-cover"
                      alt=""
                      style={{
                        filter: `blur(10px) contrast(1.5) saturate(2) hue-rotate(${i * 20}deg)`,
                        opacity: 0.7,
                        mixBlendMode: "screen",
                      }}
                      loading="lazy"
                    />
                  </div>

                  {/* Main cyberpunk image with effects */}
                  <div className="relative z-10 flex w-full justify-center py-2">
                    <img
                      src={`${doc.publishedUrl}/screenshot.png`}
                      alt={`Screenshot from ${doc.title || doc._id}`}
                      className="max-w-full object-contain"
                      style={{
                        maxHeight: "16rem",
                        filter: `contrast(1.8) saturate(2.5) blur(1.5px) brightness(1.2) drop-shadow(0 0 15px ${NEONS[(i + 3) % NEONS.length]})`,
                        opacity: 0.88,
                        mixBlendMode: "screen",
                      }}
                      loading="lazy"
                    />
                  </div>

                  {/* Gradient overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 z-20"
                    style={{
                      background: `linear-gradient(120deg, transparent 60%, ${NEONS[(i + 4) % NEONS.length]}66 100%)`,
                      mixBlendMode: "screen",
                    }}
                  />
                </div>
              )}
              <div className="mt-2 flex space-x-2">
                {doc.slug && (
                  <a
                    href={`/remix/${doc.slug}`}
                    className="rounded border px-3 py-2 font-mono text-xs tracking-widest uppercase shadow"
                    style={{
                      color: NEONS[(i + 5) % NEONS.length],
                      borderColor: NEONS[(i + 6) % NEONS.length],
                      background: `${NEONS[(i + 7) % NEONS.length]}11`,
                      textShadow: `0 0 5px ${NEONS[(i + 5) % NEONS.length]}`,
                      animation: "flicker 1.2s infinite",
                    }}
                  >
                    REMIX
                  </a>
                )}
                {doc.publishedUrl && (
                  <a
                    href={doc.publishedUrl}
                    className="rounded border px-3 py-2 font-mono text-xs tracking-widest uppercase shadow"
                    style={{
                      color: NEONS[(i + 6) % NEONS.length],
                      borderColor: NEONS[(i + 7) % NEONS.length],
                      background: `${NEONS[(i + 8) % NEONS.length]}11`,
                      textShadow: `0 0 5px ${NEONS[(i + 6) % NEONS.length]}`,
                      animation: "glitch 0.4s infinite",
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    VIEW LIVE
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {/* Glitch overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-50"
        style={{
          mixBlendMode: "difference",
          opacity: glitch ? 0.18 : 0.08,
          background: `repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 4px)`,
        }}
      />
      {/* Neon border flicker */}
      <div
        className="pointer-events-none absolute inset-0 z-40"
        style={{
          borderRadius: "22px",
          boxShadow: `0 0 80px 10px ${NEONS[bgIndex]}cc,0 0 120px 20px #fff5`,
          border: `2px solid ${NEONS[(bgIndex + 1) % NEONS.length]}`,
          opacity: glitch ? 0.7 : 0.3,
          transition: "all 0.2s",
        }}
      />
      {/* Color cycling overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-30"
        style={{
          background: `linear-gradient(120deg,${NEONS[bgIndex]}33 0%,transparent 60%,${NEONS[(bgIndex + 1) % NEONS.length]}33 100%)`,
          mixBlendMode: "color-dodge",
          opacity: 0.22,
        }}
      />
      {/* CRT corner marks */}
      <div
        className="absolute top-0 left-0 h-10 w-10 border-t-4 border-l-4"
        style={{ borderColor: NEONS[bgIndex], opacity: 0.8 }}
      />
      <div
        className="absolute top-0 right-0 h-10 w-10 border-t-4 border-r-4"
        style={{
          borderColor: NEONS[(bgIndex + 1) % NEONS.length],
          opacity: 0.8,
        }}
      />
      <div
        className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4"
        style={{
          borderColor: NEONS[(bgIndex + 2) % NEONS.length],
          opacity: 0.8,
        }}
      />
      <div
        className="absolute right-0 bottom-0 h-10 w-10 border-r-4 border-b-4"
        style={{
          borderColor: NEONS[(bgIndex + 3) % NEONS.length],
          opacity: 0.8,
        }}
      />
    </div>
  );
}

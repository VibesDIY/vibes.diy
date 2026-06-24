import React, { useState, useCallback } from "react";
import { VibesSwitch, gridBackground, cx } from "@vibes.diy/base";
import SessionSidebar from "../components/SessionSidebar.js";

export function meta() {
  return [
    { title: "About - Vibes DIY" },
    { name: "description", content: "Make apps with your friends, so easy even AI can do it" },
  ];
}

const link: React.CSSProperties = {
  color: "rgb(217, 42, 28)",
  textDecoration: "underline",
  cursor: "pointer",
};

// Use cases — every one is the same move: start from someone else's vibe, tweak it
// to fit you, share it, and the people you share with remix their own version.
const useCases: { title: string; body: string }[] = [
  {
    title: "Fan fiction that talks back",
    body: "Start from a character bot, make it answer in your voice, and run a shared story with your friends.",
  },
  {
    title: "Neighborhood tools",
    body: "Copy a resource tracker, fit it to your city, and share a live tool at the next town meeting — no grant, no dev team.",
  },
  {
    title: "Hobby logs",
    body: "A restoration tracker you tweak for your garage, then share with the whole car club.",
  },
  {
    title: "Class games",
    body: "Remix a flashcard app into collaborative trivia your students change live as they play.",
  },
  {
    title: "Shared routines",
    body: "A workout tracker each client makes their own — and a whole gym starts swapping routines.",
  },
  {
    title: "Listeners become makers",
    body: "Tweak a chord-progression vibe to your style; fans remix their own and feed your next track.",
  },
];

export default function About() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);

  return (
    <div className={cx(gridBackground, "page-grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full")}>
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} />

      <div className="px-8 pt-0">
        <div className="mb-8 ml-0 relative z-20">
          <VibesSwitch size={75} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
        </div>

        <div style={{ maxWidth: 1100, width: "100%", margin: "0 auto", paddingBottom: 100 }}>
          {/* Hero — full width, big type */}
          <div style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: 60 }}>
            <div
              style={{
                height: 30,
                width: "100%",
                backgroundColor: "rgba(31, 15, 152, 0.4)",
                border: "1px solid black",
                marginBottom: 1,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.38)",
              }}
            />
            <div
              style={{
                backgroundColor: "rgb(255, 255, 240)",
                color: "rgb(34, 31, 32)",
                border: "1px solid black",
                boxShadow: "0 0 0 1px white",
                padding: "40px 32px",
              }}
            >
              <h1 style={{ fontWeight: "bold", fontSize: 56, lineHeight: "56px", color: "rgb(83, 152, 201)" }}>
                Software is getting weird again.
              </h1>
              <p style={{ marginTop: 16, fontSize: 20, maxWidth: 600 }}>Make apps with your friends, so easy even AI can do it.</p>
            </div>
          </div>

          {/* Two-up row: Group Chat + Accent */}
          <div style={{ display: "flex", gap: 24, marginBottom: 60, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Impress the group chat — wide */}
            <div style={{ flex: "2 1 300px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <div
                style={{
                  height: 30,
                  width: "100%",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid black",
                  marginBottom: 1,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.38)",
                }}
              />
              <div
                style={{
                  backgroundColor: "rgb(255, 255, 240)",
                  color: "rgb(34, 31, 32)",
                  border: "1px solid black",
                  boxShadow: "0 0 0 1px white",
                  padding: "24px 24px",
                }}
              >
                <h2 style={{ fontWeight: "bold", fontSize: 40, lineHeight: "40px" }}>Impress the group chat</h2>
                <p style={{ marginTop: 14, fontSize: 15, opacity: 0.7 }}>
                  Describe what you want, get a live app. Share the link. Your friends join instantly and see real data&mdash;no
                  setup, no &ldquo;wait let me send you the invite.&rdquo;
                </p>
              </div>
            </div>

            {/* Yellow accent — narrow */}
            <div style={{ flex: "1 1 200px", border: "1px solid rgb(253, 192, 0)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <div
                style={{
                  height: 10,
                  width: "100%",
                  backgroundColor: "rgba(254, 221, 0, 0.608)",
                  borderBottom: "1px solid rgb(252, 166, 0)",
                }}
              />
              <div style={{ padding: "20px 16px", backgroundColor: "rgb(254, 221, 0)", color: "rgb(0, 0, 0)" }}>
                <p style={{ fontWeight: "bold", fontSize: 28, lineHeight: "30px" }}>
                  No gatekeeping, no walled garden, your code your app
                </p>
              </div>
            </div>
          </div>

          {/* Actually collaborative — centered, narrower */}
          <div
            style={{
              maxWidth: 700,
              margin: "0 auto 60px",
              textAlign: "center",
              backgroundColor: "rgba(255, 255, 240, 0.85)",
              padding: "32px 40px",
              border: "1px solid black",
            }}
          >
            <h2 style={{ fontWeight: "bold", fontSize: 48, lineHeight: "48px", color: "rgb(83, 152, 201)" }}>
              Actually collaborative
            </h2>
            <p style={{ marginTop: 16, fontSize: 18, color: "rgb(34, 31, 32)" }}>
              Everyone in your vibe sees the same live state. Someone adds an item, everyone sees it. It works like a shared doc,
              except it&rsquo;s a full app you described into existence.
            </p>
          </div>

          {/* Red + Blue accent row */}
          <div style={{ display: "flex", gap: 24, marginBottom: 60, alignItems: "stretch", flexWrap: "wrap" }}>
            {/* Yours not theirs — red */}
            <div style={{ flex: "1 1 280px", border: "1px solid rgb(159, 1, 0)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <div
                style={{
                  height: 10,
                  width: "100%",
                  backgroundColor: "rgba(218, 41, 28, 0.608)",
                  borderBottom: "1px solid rgb(127, 1, 0)",
                }}
              />
              <div style={{ padding: "24px 16px", backgroundColor: "rgb(218, 41, 28)", color: "white" }}>
                <h2 style={{ fontWeight: "bold", fontSize: 32, lineHeight: "34px" }}>Yours to control.</h2>
                <p style={{ marginTop: 12, fontWeight: "bold", fontSize: 18, lineHeight: "24px" }}>
                  Private by default&mdash;or open to the world. You choose.
                </p>
                <p style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                  Keep it to the people you invite, or publish it so anyone can use and remix it. You set who can read, write, and
                  open it.
                </p>
              </div>
            </div>

            {/* Deploy loop — blue */}
            <div style={{ flex: "1 1 280px", border: "1px solid rgb(0, 56, 134)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <div
                style={{
                  height: 10,
                  width: "100%",
                  backgroundColor: "rgba(0, 154, 206, 0.608)",
                  borderBottom: "1px solid rgb(0, 45, 106)",
                }}
              />
              <div style={{ padding: "24px 16px", backgroundColor: "rgb(0, 154, 206)", color: "white" }}>
                <h2 style={{ fontWeight: "bold", fontSize: 32, lineHeight: "34px" }}>One push, it&rsquo;s live.</h2>
                <p style={{ marginTop: 12, fontWeight: "bold", fontSize: 18, lineHeight: "24px" }}>
                  Your app gets a real link and remembers everything&mdash;automatically.
                </p>
                <p style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                  Nothing to deploy, nothing to wire up. Describe a change and ship it again in seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Big statement — offset right */}
          <style>{`
            .vibes-everyone {
              max-width: 630px;
              margin-left: auto;
              margin-bottom: 60px;
              text-align: right;
              background-color: rgba(255, 255, 240, 0.85);
              padding: 28px 32px;
              border: 1px solid black;
              min-height: 140px;
              background-image: url(/computer-anim.gif);
              background-position: left center;
              background-repeat: no-repeat;
              background-size: contain;
              padding-left: 200px;
            }
            @media (max-width: 600px) {
              .vibes-everyone {
                background-image: none;
                padding-left: 32px;
                min-height: unset;
              }
            }
          `}</style>
          <div className="vibes-everyone">
            <p style={{ fontWeight: "bold", fontSize: 36, lineHeight: "40px", color: "rgb(34, 31, 32)" }}>
              Vibes are for everyone.
            </p>
            <p style={{ marginTop: 12, fontSize: 14, opacity: 0.6, color: "rgb(34, 31, 32)" }}>
              You and your friends aren&rsquo;t users anymore. You&rsquo;re makers.
            </p>
          </div>

          {/* What people make — use cases */}
          <div style={{ marginBottom: 60 }}>
            <h2 style={{ fontWeight: "bold", fontSize: 40, lineHeight: "42px", color: "rgb(34, 31, 32)", marginBottom: 20 }}>
              What people make
            </h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {useCases.map((u) => (
                <div
                  key={u.title}
                  style={{
                    flex: "1 1 240px",
                    border: "1px solid black",
                    backgroundColor: "rgba(255, 255, 240, 0.85)",
                    padding: "18px 20px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <p style={{ fontWeight: "bold", fontSize: 18, lineHeight: "22px", marginBottom: 6, color: "rgb(34, 31, 32)" }}>
                    {u.title}
                  </p>
                  <p style={{ fontSize: 14, lineHeight: "20px", opacity: 0.75, color: "rgb(34, 31, 32)" }}>{u.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Open source — orange header, cream body, offset left */}
          <div style={{ maxWidth: 550, marginBottom: 80, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <div
              style={{
                height: 30,
                width: "100%",
                backgroundColor: "rgb(255, 153, 0)",
                border: "1px solid rgb(200, 100, 0)",
                marginBottom: 1,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.38)",
              }}
            />
            <div
              style={{
                backgroundColor: "rgb(255, 255, 240)",
                color: "rgb(34, 31, 32)",
                border: "1px solid black",
                boxShadow: "0 0 0 1px white",
                padding: "24px 24px",
              }}
            >
              <h2 style={{ fontWeight: "bold", fontSize: 32, lineHeight: "34px", color: "rgb(200, 100, 0)" }}>Open source.</h2>
              <p style={{ marginTop: 10, fontSize: 15 }}>Read the code, open an issue, send a PR.</p>
              <p style={{ marginTop: 14, fontSize: 14 }}>
                <a href="https://discord.gg/vnpWycj4Ta" target="_blank" rel="noopener noreferrer" style={link}>
                  Discord
                </a>
                {" · "}
                <a href="https://github.com/VibesDIY/vibes.diy" target="_blank" rel="noopener noreferrer" style={link}>
                  GitHub
                </a>
                {" · "}
                <a href="https://vibesdiy.substack.com/" target="_blank" rel="noopener noreferrer" style={link}>
                  Substack
                </a>
                {" · "}
                <a href="https://www.youtube.com/@VibesDIY" target="_blank" rel="noopener noreferrer" style={link}>
                  YouTube
                </a>
                {" · "}
                <a href="https://bsky.app/profile/vibes.diy" target="_blank" rel="noopener noreferrer" style={link}>
                  Bluesky
                </a>
              </p>
            </div>
          </div>

          {/* Footer — quiet */}
          <div className="text-gray-600 dark:text-gray-300" style={{ textAlign: "center", fontSize: 12 }}>
            Copyright &copy; 2026{" "}
            <a href="https://vibes.diy" style={link}>
              Vibes DIY
            </a>
            {" · "}
            <a href="mailto:help@vibes.diy" style={link}>
              Email Support
            </a>
            {" · "}
            <a href="/legal/privacy" style={link}>
              Privacy Policy
            </a>
            {" · "}
            <a href="/legal/tos" style={link}>
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

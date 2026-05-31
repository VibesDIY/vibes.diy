import React, { useState, useCallback } from "react";
import { VibesSwitch, gridBackground, cx } from "@vibes.diy/base";
import SessionSidebar from "../components/SessionSidebar.js";

export function meta() {
  return [
    { title: "Help - Vibes DIY" },
    { name: "description", content: "Get help building with Vibes DIY — guides, FAQs, and creator documentation" },
  ];
}

const link: React.CSSProperties = {
  color: "rgb(217, 42, 28)",
  textDecoration: "underline",
  cursor: "pointer",
};

const guides = [
  {
    number: "01",
    title: "How to Make & Share an App",
    description: "Step-by-step screenshot walkthrough — from prompt to live, shareable app in minutes.",
    href: "https://good.vibes.diy/how-to/",
    accent: "rgb(0, 154, 206)",
    border: "rgb(0, 56, 134)",
  },
  {
    number: "02",
    title: "CLI: npx vibes-diy generate",
    description: "One command deploys a live React app from a prompt. Ship from your terminal.",
    href: "https://good.vibes.diy/generate.html",
    accent: "rgb(218, 41, 28)",
    border: "rgb(159, 1, 0)",
  },
  {
    number: "03",
    title: "Connect Backend Data",
    description: "Read and write live database from JS backends — Node, Deno, Bun, Cloudflare Workers.",
    href: "https://good.vibes.diy/connect-backend-data/",
    accent: "rgb(200, 100, 0)",
    border: "rgb(180, 80, 0)",
  },
  {
    number: "04",
    title: "Vibes Connect",
    description: "Real-time subscriptions, webhook fan-out, cron scripts, AI pipelines, and multi-surface sync.",
    href: "https://good.vibes.diy/vibes-connect/",
    accent: "rgb(83, 152, 201)",
    border: "rgb(40, 100, 160)",
  },
  {
    number: "Ref",
    title: "Sharing & Access",
    description: "App visibility, permissions, Clone vs Remix, and sharing controls explained.",
    href: "https://good.vibes.diy/sharing/",
    accent: "rgb(100, 100, 100)",
    border: "rgb(60, 60, 60)",
  },
];

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I delete my data?",
    a: (
      <>
        To permanently delete app data, go to{" "}
        <a href="/settings" style={link}>
          Settings
        </a>{" "}
        and delete the user slug that owns that app. This permanently deletes that user slug and all apps connected to it,
        and cannot be undone. There is currently no in-app &ldquo;Delete account&rdquo; button. For account deletion help, email{" "}
        <a href="mailto:help@vibes.diy" style={link}>
          help@vibes.diy
        </a>
        .
      </>
    ),
  },
  {
    q: "How do I share my app?",
    a: (
      <>
        Every published vibe gets a live URL you can share directly. See our{" "}
        <a href="https://good.vibes.diy/sharing/" target="_blank" rel="noopener noreferrer" style={link}>
          Sharing & Access guide
        </a>{" "}
        for details on visibility controls and who can join.
      </>
    ),
  },
  {
    q: "Can I remix someone else's app?",
    a: "Yes — any public vibe has a Remix button. Remixing forks the app into your account so you can build on it independently. The original creator keeps their copy.",
  },
  {
    q: "Is my data private?",
    a: "Your app data lives in your vibe, encrypted by Fireproof. It's private by default — you approve who gets in. No algorithm or platform decides what happens to your stuff.",
  },
  {
    q: "How do I use Vibes from the command line?",
    a: (
      <>
        Run{" "}
        <code style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.07)", padding: "1px 5px", borderRadius: 3 }}>
          npx vibes-diy generate
        </code>{" "}
        and describe your app. See the{" "}
        <a href="https://good.vibes.diy/generate.html" target="_blank" rel="noopener noreferrer" style={link}>
          CLI guide
        </a>{" "}
        for options.
      </>
    ),
  },
  {
    q: "How do I connect my vibe to a backend?",
    a: (
      <>
        Check out the{" "}
        <a href="https://good.vibes.diy/connect-backend-data/" target="_blank" rel="noopener noreferrer" style={link}>
          Connect Backend Data guide
        </a>{" "}
        — it covers Node, Deno, Bun, and Cloudflare Workers.
      </>
    ),
  },
  {
    q: "Where can I get more help?",
    a: (
      <>
        Join us on{" "}
        <a href="https://discord.gg/vnpWycj4Ta" target="_blank" rel="noopener noreferrer" style={link}>
          Discord
        </a>{" "}
        or email{" "}
        <a href="mailto:help@vibes.diy" style={link}>
          help@vibes.diy
        </a>
        .
      </>
    ),
  },
];

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(0,0,0,0.12)",
        cursor: "pointer",
      }}
      onClick={() => setOpen((v) => !v)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
          fontWeight: "bold",
          fontSize: 16,
          color: "rgb(34, 31, 32)",
          userSelect: "none",
        }}
      >
        <span>{q}</span>
        <span style={{ fontSize: 20, color: "rgb(217, 42, 28)", flexShrink: 0, marginLeft: 12 }}>{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div style={{ paddingBottom: 16, fontSize: 15, color: "rgb(34, 31, 32)", opacity: 0.85, lineHeight: "1.6" }}>{a}</div>
      )}
    </div>
  );
}

export default function Help() {
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
          {/* Hero */}
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
              <h1 style={{ fontWeight: "bold", fontSize: 56, lineHeight: "56px", color: "rgb(83, 152, 201)" }}>Help & Docs</h1>
              <p style={{ marginTop: 16, fontSize: 20, maxWidth: 600 }}>Guides, references, and answers to common questions.</p>
            </div>
          </div>

          {/* Video embed */}
          <div style={{ marginBottom: 60, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <div
              style={{
                height: 10,
                width: "100%",
                backgroundColor: "rgba(254, 221, 0, 0.608)",
                borderBottom: "1px solid rgb(252, 166, 0)",
              }}
            />
            <div
              style={{
                border: "1px solid rgb(252, 166, 0)",
                backgroundColor: "rgb(255, 255, 240)",
                padding: "24px",
              }}
            >
              <h2 style={{ fontWeight: "bold", fontSize: 28, marginBottom: 16, color: "rgb(34, 31, 32)" }}>
                Get started in 2 minutes
              </h2>
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <iframe
                  src="https://www.youtube.com/embed/z7GKn2CJkW8"
                  title="Get started with Vibes DIY"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Creator Guides */}
          <div style={{ marginBottom: 60 }}>
            <h2 style={{ fontWeight: "bold", fontSize: 36, marginBottom: 24, color: "rgb(34, 31, 32)" }}>Creator Guides</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {guides.map((g) => (
                <a
                  key={g.number}
                  href={g.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      border: `1px solid ${g.border}`,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.18)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 4px rgba(0,0,0,0.08)")}
                  >
                    <div
                      style={{
                        width: 56,
                        flexShrink: 0,
                        backgroundColor: g.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: 13,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {g.number}
                    </div>
                    <div
                      style={{
                        backgroundColor: "rgb(255, 255, 240)",
                        padding: "16px 20px",
                        flex: 1,
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 17, color: "rgb(34, 31, 32)" }}>{g.title}</div>
                      <div style={{ marginTop: 4, fontSize: 14, opacity: 0.7, color: "rgb(34, 31, 32)" }}>{g.description}</div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: 16,
                        backgroundColor: "rgb(255, 255, 240)",
                        color: g.accent,
                        fontSize: 20,
                      }}
                    >
                      →
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div style={{ marginBottom: 80, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
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
                border: "1px solid black",
                boxShadow: "0 0 0 1px white",
                padding: "32px",
              }}
            >
              <h2 style={{ fontWeight: "bold", fontSize: 40, marginBottom: 8, color: "rgb(34, 31, 32)" }}>
                Frequently Asked Questions
              </h2>
              <div style={{ marginTop: 24 }}>
                {faqs.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
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

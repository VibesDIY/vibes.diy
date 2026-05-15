import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClerk } from "@clerk/react";
import { Result } from "@adviser/cement";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import type { ResReportGrowthMemberships, ResReportGrowthVibesWithData } from "@vibes.diy/api-types";
import { MembershipsChart, VibesWithDataChart } from "./Chart.js";

interface AppProps {
  readonly getClerkToken: () => Promise<string | null>;
}

// Same-origin WS — the reports SPA is served by the same worker that
// terminates /api/*, so we always derive the api URL from window.location
// rather than shipping it through config.json.
function deriveApiUrl(): string {
  const proto = window.location.protocol.startsWith("https") ? "wss" : "ws";
  return `${proto}://${window.location.host}/api`;
}

type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "err"; readonly msg: string };

export function App({ getClerkToken }: AppProps) {
  const clerk = useClerk();
  const apiRef = useRef<VibesDiyApi | undefined>(undefined);

  // VibesDiyApi instance is stable for the page lifetime — re-creating it
  // tears down the WS, so memoize via ref so the websocket survives
  // re-renders.
  if (apiRef.current === undefined) {
    apiRef.current = new VibesDiyApi({
      apiUrl: deriveApiUrl(),
      getToken: async () => {
        const token = await getClerkToken();
        if (token === null) return Result.Err("no clerk token");
        return Result.Ok({ type: "clerk", token });
      },
    });
  }
  const api = apiRef.current;

  const [memberships, setMemberships] = useState<Loadable<ResReportGrowthMemberships>>({ kind: "loading" });
  const [vibes, setVibes] = useState<Loadable<ResReportGrowthVibesWithData>>({ kind: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const [m, v] = await Promise.all([api.reportGrowthMemberships({}), api.reportGrowthVibesWithData({})]);
      if (ac.signal.aborted) return;
      if (m.isOk()) setMemberships({ kind: "ok", data: m.Ok() });
      else setMemberships({ kind: "err", msg: m.Err().message });
      if (v.isOk()) setVibes({ kind: "ok", data: v.Ok() });
      else setVibes({ kind: "err", msg: v.Err().message });
    })();
    return () => ac.abort();
  }, [api]);

  const generatedAt = useMemo(() => {
    if (memberships.kind === "ok") return memberships.data.generatedAt;
    if (vibes.kind === "ok") return vibes.data.generatedAt;
    return undefined;
  }, [memberships, vibes]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 24,
          paddingBottom: 12,
          borderBottom: "1px solid #1a2030",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.2 }}>vibes.diy growth</h1>
          <div style={{ marginTop: 4, color: "#8b95a5", fontSize: 12 }}>
            {generatedAt === undefined ? "loading…" : `as of ${generatedAt}`}
          </div>
        </div>
        <button
          onClick={() => void clerk.signOut()}
          style={{
            background: "transparent",
            color: "#8b95a5",
            border: "1px solid #2a3142",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          sign out
        </button>
      </header>

      <Section
        title="Memberships Over 30 Days"
        subtitle="Daily cumulative count. Approved request or accepted invite to one specific vibe = one membership. Hover any point for new members that day."
      >
        <MembershipsBody loadable={memberships} />
      </Section>

      <Section title="Vibes With Data" subtitle="Daily cumulative count of distinct (userSlug, appSlug) pairs in AppSlugBindings.">
        <VibesWithDataBody loadable={vibes} />
      </Section>
    </div>
  );
}

function MembershipsBody({ loadable }: { loadable: Loadable<ResReportGrowthMemberships> }) {
  if (loadable.kind === "loading") return <Placeholder>loading…</Placeholder>;
  if (loadable.kind === "err") return <ErrorBox msg={loadable.msg} />;
  return (
    <>
      <Stat label="total" value={loadable.data.total} />
      <MembershipsChart data={loadable.data} />
    </>
  );
}

function VibesWithDataBody({ loadable }: { loadable: Loadable<ResReportGrowthVibesWithData> }) {
  if (loadable.kind === "loading") return <Placeholder>loading…</Placeholder>;
  if (loadable.kind === "err") return <ErrorBox msg={loadable.msg} />;
  return (
    <>
      <Stat label="total" value={loadable.data.total} />
      <VibesWithDataChart data={loadable.data} />
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "4px 0 16px", color: "#8b95a5", fontSize: 12, maxWidth: 720 }}>{subtitle}</p>
      <div
        style={{
          background: "#11151d",
          border: "1px solid #1a2030",
          borderRadius: 8,
          padding: 20,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 28, fontWeight: 600, color: "#f4f6fa" }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 12, color: "#8b95a5" }}>{label}</span>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#8b95a5", padding: 12 }}>{children}</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        color: "#ff8a8a",
        background: "#2a1518",
        border: "1px solid #4a1f24",
        borderRadius: 6,
        padding: 12,
        fontSize: 12,
        whiteSpace: "pre-wrap",
      }}
    >
      {msg}
    </div>
  );
}

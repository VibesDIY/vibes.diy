import React, { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/react";
import { Result } from "@adviser/cement";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import type { ResReportGrowthMemberships, ResReportGrowthVibesWithData } from "@vibes.diy/api-types";
import { MembershipsChart, VibesWithDataChart } from "./Chart.js";
import vibesDiyLogoUrl from "./vibes-diy-logo.svg";

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

  return (
    <div className="page">
      <ColorStripe />

      <div className="grid-2-1">
        <div className="card card--hero hero">
          <span className="section-label">Growth Report</span>
          <VibesDiyLogo />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card card--red callout">
            <span className="section-label" style={{ borderColor: "var(--cream)", color: "var(--cream)" }}>
              Builders Joining
            </span>
            <Metric loadable={memberships} pick={(d) => d.total} accent="cream" />
            <p style={{ color: "rgba(255,255,255,0.85)" }}>Non-owner users with durable access to one specific vibe.</p>
          </div>
          <div className="card card--yellow callout">
            <span className="section-label" style={{ borderColor: "var(--black)", color: "var(--black)" }}>
              Vibes With Data
            </span>
            <Metric loadable={vibes} pick={(d) => d.total} accent="black" />
            <p style={{ color: "var(--near-black)" }}>Distinct userSlug/appSlug pairs in AppSlugBindings.</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
        <button className="btn" onClick={() => void clerk.signOut()}>
          Sign out
        </button>
      </div>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">30 Days</span>
          <h2 className="section-title">Memberships over time</h2>
          <p className="section-intro">
            Daily cumulative total of currently active memberships. One non-owner user with durable access to one specific vibe by
            approved request or accepted invite counts as one membership. Hover any point to see who joined that day.
          </p>
          {memberships.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : memberships.kind === "err" ? (
            <ErrorPanel msg={memberships.msg} />
          ) : (
            <MembershipsChart data={memberships.data} />
          )}
        </div>
      </section>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">30 Days</span>
          <h2 className="section-title">Vibes with data over time</h2>
          <p className="section-intro">
            Daily cumulative total of vibes with Fireproof data written by their owner. Each distinct userSlug/appSlug pair in
            AppSlugBindings counts as one active vibe.
          </p>
          {vibes.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : vibes.kind === "err" ? (
            <ErrorPanel msg={vibes.msg} />
          ) : (
            <VibesWithDataChart data={vibes.data} />
          )}
        </div>
      </section>

      <ColorStripe />
    </div>
  );
}

// Brand-canonical logo from landing-pages/vibes-diy-logo.svg. Copied
// verbatim into src/ so the hero ships the same artwork as the marketing
// site — no React reimplementation, no drift if marketing tweaks the file.
function VibesDiyLogo() {
  return (
    <img
      src={vibesDiyLogoUrl}
      alt="Vibes DIY"
      style={{ height: "clamp(64px, 11vw, 120px)", width: "auto", display: "block", marginTop: "0.25rem" }}
    />
  );
}

function ColorStripe() {
  return (
    <div className="color-stripe">
      <div style={{ background: "var(--red)" }} />
      <div style={{ background: "var(--cyan)" }} />
      <div style={{ background: "var(--yellow)" }} />
      <div style={{ background: "var(--near-black)" }} />
      <div style={{ background: "var(--red)" }} />
      <div style={{ background: "var(--cyan)" }} />
    </div>
  );
}

function Metric<T>({
  loadable,
  pick,
  accent,
}: {
  readonly loadable: Loadable<T>;
  readonly pick: (data: T) => number;
  readonly accent: "cream" | "black";
}) {
  const text = loadable.kind === "ok" ? pick(loadable.data).toLocaleString() : loadable.kind === "err" ? "—" : "…";
  const color = accent === "cream" ? "var(--cream)" : "var(--black)";
  return (
    <div className="callout-stat" style={{ color }}>
      {text}
    </div>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <div className="err">
      <div className="err-label">Error</div>
      <div>{msg}</div>
    </div>
  );
}

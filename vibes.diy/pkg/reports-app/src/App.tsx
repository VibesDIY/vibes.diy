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
    <main>
      <div className="hero">
        <div className="hero-top">
          <div className="hero-panel">
            <div className="hero-kicker">Team Snapshot</div>
            <h1>Vibes.diy Growth</h1>
            <p>{generatedAt === undefined ? "Loading the latest counts…" : `Generated ${generatedAt}.`}</p>
          </div>
          <button className="btn" onClick={() => void clerk.signOut()}>
            Sign out
          </button>
        </div>
        <div className="meta">
          <MetricCard label="Memberships" loadable={memberships} pick={(d) => d.total} />
          <MetricCard label="Vibes With Data" loadable={vibes} pick={(d) => d.total} />
        </div>
      </div>

      <section>
        <h2>Memberships Over 30 Days</h2>
        <p>
          Daily cumulative total of currently active memberships, where one membership is one non-owner user with durable access to
          one specific vibe by approved request or accepted invite. Hover any point for new members that day.
        </p>
        {memberships.kind === "loading" ? (
          <div className="empty">Loading…</div>
        ) : memberships.kind === "err" ? (
          <ErrorPanel msg={memberships.msg} />
        ) : (
          <MembershipsChart data={memberships.data} />
        )}
      </section>

      <section>
        <h2>Vibes With Data</h2>
        <p>
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
      </section>
    </main>
  );
}

function MetricCard<T>({
  label,
  loadable,
  pick,
}: {
  readonly label: string;
  readonly loadable: Loadable<T>;
  readonly pick: (data: T) => number;
}) {
  const text = loadable.kind === "ok" ? pick(loadable.data).toLocaleString() : loadable.kind === "err" ? "—" : "…";
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{text}</div>
    </div>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <div className="err">
      <div className="err-kicker">Error</div>
      <div>{msg}</div>
    </div>
  );
}

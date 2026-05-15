import * as React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, SignIn, useAuth } from "@clerk/react";
import { Result } from "@adviser/cement";
import { type } from "arktype";
import { App } from "./App.js";

// Two-stage boot: fetch /reports/config.json from the worker to learn the
// Clerk publishable key for this environment, then mount the Clerk-wrapped
// app. A static SPA can't read env directly, and we don't want to rebuild
// the bundle per environment — config.json is the env boundary.
const reportsConfig = type({
  type: "'vibes.diy.reports-config'",
  clerkPublishableKey: "string",
});
type ReportsConfig = typeof reportsConfig.infer;

function Loading({ msg }: { msg: string }) {
  return <div style={{ padding: 32, color: "#8b95a5" }}>{msg}</div>;
}

function FatalError({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 32, color: "#ff6b6b" }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>reports failed to load</h2>
      <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>{msg}</pre>
    </div>
  );
}

function ClerkGate({ cfg }: { cfg: ReportsConfig }) {
  return (
    <ClerkProvider publishableKey={cfg.clerkPublishableKey}>
      <AuthedShell />
    </ClerkProvider>
  );
}

function AuthedShell() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  if (isLoaded === false) return <Loading msg="loading session…" />;
  if (isSignedIn === false) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <SignIn routing="hash" forceRedirectUrl="/reports/" />
      </div>
    );
  }
  return <App getClerkToken={() => getToken({ template: "with-email" })} />;
}

async function loadConfig(): Promise<Result<ReportsConfig>> {
  const r = await fetch("/reports/config.json", { credentials: "same-origin" });
  if (r.ok === false) return Result.Err(`config.json ${r.status} ${r.statusText}`);
  const raw: unknown = await r.json();
  const parsed = reportsConfig(raw);
  if (parsed instanceof type.errors) return Result.Err(parsed.summary);
  return Result.Ok(parsed);
}

type BootState =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly cfg: ReportsConfig }
  | { readonly kind: "err"; readonly msg: string };

function Boot() {
  const [state, setState] = React.useState<BootState>({ kind: "loading" });
  React.useEffect(() => {
    const ac = new AbortController();
    void loadConfig().then((r) => {
      if (ac.signal.aborted) return;
      if (r.isOk()) setState({ kind: "ok", cfg: r.Ok() });
      else setState({ kind: "err", msg: r.Err().message });
    });
    return () => ac.abort();
  }, []);
  if (state.kind === "loading") return <Loading msg="loading config…" />;
  if (state.kind === "err") return <FatalError msg={state.msg} />;
  return <ClerkGate cfg={state.cfg} />;
}

// Defensive throw: the html template ships a #root div, so a missing
// element means the bundle was deployed without its html (or a userscript
// nuked it). There's no DOM left to render an error into.
const rootEl = document.getElementById("root");
if (rootEl === null) throw new Error("missing #root");
createRoot(rootEl).render(
  <StrictMode>
    <Boot />
  </StrictMode>
);

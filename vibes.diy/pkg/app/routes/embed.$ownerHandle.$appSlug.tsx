import React, { useEffect, useState } from "react";
import { useMatches, useParams } from "react-router";
import { BuildURI, URI } from "@adviser/cement";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import type { VibesFPApiParameters } from "@vibes.diy/api-types";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { RUNTIME_PREVIEW_IFRAME_ALLOW, RUNTIME_PREVIEW_IFRAME_SANDBOX } from "../lib/iframe-policy.js";

// The embed route is a deliberately small, chrome-free sibling of the /vibe/
// viewer. A third-party page frames this route; this route in turn frames the
// vibe runtime (appSlug--ownerHandle.<host>). It renders only the runtime
// iframe (when the vibe is publicly embeddable) or an owner-facing instruction
// card (when it isn't). No pill, share modal, sidebar, landing card, or login.

interface EmbedLoaderCtx {
  readonly vibeDiyAppParams: VibesFPApiParameters;
  readonly isPubliclyEmbeddable?: boolean;
}

interface EmbedLoaderData {
  readonly iframeUrl: string | undefined;
  readonly isPubliclyEmbeddable: boolean;
}

export async function loader(loaderCtx: {
  params: Record<string, string | undefined>;
  request: Request;
  context: EmbedLoaderCtx;
}): Promise<EmbedLoaderData> {
  const { ownerHandle, appSlug } = loaderCtx.params;
  if (!ownerHandle || !appSlug) {
    return { iframeUrl: undefined, isPubliclyEmbeddable: false };
  }
  const reqUrl = URI.from(loaderCtx.request.url);
  const protocol = reqUrl.protocol === "https:" ? "https" : "http";
  const port = reqUrl.port && reqUrl.port !== "80" && reqUrl.port !== "443" ? reqUrl.port : undefined;
  const params = loaderCtx.context.vibeDiyAppParams;
  const baseUrl = calcEntryPointUrl({
    hostnameBase: params.vibes.svc.hostnameBase,
    protocol,
    bindings: { appSlug, ownerHandle },
    port,
  });
  const reqParams = Object.fromEntries(reqUrl.getParams);
  const iframeUrl = BuildURI.from(baseUrl)
    .searchParams(reqParams, "merge")
    .setParam("npmUrl", params.pkgRepos.workspace)
    .toString();
  return {
    iframeUrl,
    isPubliclyEmbeddable: loaderCtx.context.isPubliclyEmbeddable ?? false,
  };
}

export function meta({ params }: { params: Record<string, string> }) {
  const { appSlug } = params;
  return [
    { title: `${appSlug ?? "Vibe"} — vibes.diy` },
    // Embeds shouldn't be indexed as standalone pages; the canonical surface is
    // the /vibe/ viewer.
    { name: "robots", content: "noindex" },
  ];
}

export function InstructionCard({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) {
  // Relative href resolves against this page's origin (vibes.diy), so the link
  // opens the canonical viewer in a new top-level tab where the owner can sign
  // in, publish, and enable public access. No sign-in is attempted in-frame.
  const viewerHref = `/vibe/${ownerHandle}/${appSlug}`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        height: "100%",
        minHeight: 180,
        padding: 24,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        textAlign: "center",
        color: "rgb(34, 31, 32)",
        background: "rgb(255, 255, 240)",
      }}
    >
      <h2 style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>This vibe isn’t published yet</h2>
      <p style={{ fontSize: 14, lineHeight: 1.4, margin: 0, maxWidth: 420, opacity: 0.85 }}>
        Embeds only work for public vibes. The owner needs to publish it and enable public access to make this embed go live.
      </p>
      <a
        href={viewerHref}
        target="_blank"
        rel="noopener"
        style={{
          marginTop: 4,
          display: "inline-block",
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          color: "white",
          background: "rgb(0, 154, 206)",
          border: "1px solid black",
          textDecoration: "none",
        }}
      >
        Open on vibes.diy
      </a>
    </div>
  );
}

export default function EmbedRoute() {
  const { ownerHandle, appSlug } = useParams<{ ownerHandle: string; appSlug: string }>();
  useDocumentTitle(`${appSlug ?? "vibe"} — vibes.diy`);
  const vctx = useVibesDiy();

  // Prefer the SSR-computed iframe URL so the runtime starts fetching from the
  // first byte of HTML. Fall back to client computation when the loader didn't
  // run (e.g. SSR-safety test with a non-data router).
  const matches = useMatches();
  const loaderData = matches[matches.length - 1]?.data as { iframeUrl?: string; isPubliclyEmbeddable?: boolean } | undefined;
  const ssrEmbeddable = loaderData?.isPubliclyEmbeddable ?? false;
  const [iframeUrl, setIframeUrl] = useState<string | undefined>(loaderData?.iframeUrl);

  // grantOk is the authoritative live gate. undefined = not yet resolved (use
  // the SSR hint to paint); true/false = confirmed public-access or not.
  const [grantOk, setGrantOk] = useState<boolean | undefined>(undefined);

  const ssrIframeUrl = loaderData?.iframeUrl;
  useEffect(() => {
    if (ssrIframeUrl) return;
    if (!appSlug || !ownerHandle) {
      setIframeUrl(undefined);
      return;
    }
    const myUrl = URI.from(window.location.href);
    const port = myUrl.port && myUrl.port !== "80" && myUrl.port !== "443" ? myUrl.port : undefined;
    const baseUrl = calcEntryPointUrl({
      hostnameBase: vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE,
      protocol: myUrl.protocol === "https:" ? "https" : "http",
      bindings: { appSlug, ownerHandle },
      port,
    });
    const myParams = Object.fromEntries(myUrl.getParams);
    setIframeUrl(
      BuildURI.from(baseUrl).searchParams(myParams, "merge").setParam("npmUrl", vctx.webVars.pkgRepos.workspace).toString()
    );
  }, [ssrIframeUrl, appSlug, ownerHandle, vctx.webVars.env.VIBES_SVC_HOSTNAME_BASE, vctx.webVars.pkgRepos.workspace]);

  // Authoritative anonymous-access check: confirm a public-access grant.
  // Anything else (req-login.request from an auto-accept app, revoked, private,
  // not-found) falls back to the instruction card. Never prompts sign-in.
  useEffect(() => {
    if (!appSlug || !ownerHandle) return;
    let cancelled = false;
    vctx.chatApi.getAppByFsId({ appSlug, ownerHandle }).then((rRes) => {
      if (cancelled || rRes.isErr()) return;
      setGrantOk(rRes.Ok().grant === "public-access");
    });
    return () => {
      cancelled = true;
    };
  }, [appSlug, ownerHandle, vctx.chatApi]);

  const showIframe = grantOk === undefined ? ssrEmbeddable : grantOk;

  if (showIframe && iframeUrl) {
    return (
      <iframe
        src={iframeUrl}
        title={`${appSlug ?? "vibe"} — made on vibes.diy`}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
        sandbox={RUNTIME_PREVIEW_IFRAME_SANDBOX}
        allow={RUNTIME_PREVIEW_IFRAME_ALLOW}
      />
    );
  }

  return <InstructionCard ownerHandle={ownerHandle ?? ""} appSlug={appSlug ?? ""} />;
}

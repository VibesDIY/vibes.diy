import React, { useEffect, useState } from "react";
import { useVibesDiy } from "../../../vibes-diy-provider.js";
import { RequestsSection } from "./RequestsSection.js";
import { toastError } from "./shared.jsx";
import { type RequestGrantItem } from "./shared.js";
import { AppSettings } from "@vibes.diy/api-types";

interface RequestsCardProps {
  userSlug: string;
  appSlug: string;
  /** When true, hides the inner "Requests" header, enable/disable toggle, and auto-accept checkbox. */
  hideHeader?: boolean;
}

const PAGER = { limit: 100 };

/**
 * Self-contained card matching the Settings > Sharing "Requests" block.
 * Loads settings + request grants, wires approve / reject / role / remove
 * actions, and renders the shared RequestsSection (Pending, Approved, Revoked).
 */
export function PendingRequestsCard({ userSlug, appSlug, hideHeader }: RequestsCardProps) {
  const { vibeDiyApi } = useVibesDiy();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [requests, setRequests] = useState<RequestGrantItem[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!userSlug || !appSlug) return;
    let cancelled = false;
    Promise.all([
      vibeDiyApi.ensureAppSettings({ appSlug, userSlug }),
      vibeDiyApi.listRequestGrants({ appSlug, userSlug, pager: PAGER }),
    ]).then(([rSettings, rRequests]) => {
      if (cancelled) return;
      toastError(rSettings, (s) => setSettings(s.settings));
      toastError(rRequests, (s) => setRequests(s.items));
    });
    return () => {
      cancelled = true;
    };
  }, [vibeDiyApi, userSlug, appSlug]);

  async function toggleEnableRequest() {
    if (!settings) return;
    const enabled = !!settings.entry.enableRequest?.enable;
    setToggling("request");
    const res = await vibeDiyApi.ensureAppSettings({ appSlug, userSlug, request: { enable: !enabled } });
    setToggling(null);
    toastError(res, (s) => setSettings(s.settings));
  }

  async function toggleAutoAcceptRole() {
    if (!settings?.entry.enableRequest) return;
    setToggling("autoAcceptRole");
    const currentRole = settings.entry.enableRequest.autoAcceptRole;
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      request: { enable: true, autoAcceptRole: currentRole ? undefined : "viewer" },
    });
    setToggling(null);
    toastError(res, (s) => setSettings(s.settings));
  }

  async function approveRequest(r: RequestGrantItem, role: "editor" | "viewer") {
    const res = await vibeDiyApi.approveRequest({ appSlug, userSlug, foreignUserId: r.foreignUserId, role });
    toastError(res, () => {
      setRequests((prev) =>
        prev.map((x) => (x.foreignUserId === r.foreignUserId ? { ...x, state: "approved" as const, role } : x))
      );
    });
  }

  async function revokeRequest(r: RequestGrantItem) {
    const res = await vibeDiyApi.revokeRequest({ appSlug, userSlug, foreignUserId: r.foreignUserId });
    toastError(res, () => {
      setRequests((prev) => prev.map((x) => (x.foreignUserId === r.foreignUserId ? { ...x, state: "revoked" as const } : x)));
    });
  }

  async function switchRequestRole(r: RequestGrantItem, newRole: "editor" | "viewer") {
    const res = await vibeDiyApi.requestSetRole({ appSlug, userSlug, foreignUserId: r.foreignUserId, role: newRole });
    toastError(res, () => {
      setRequests((prev) => prev.map((x) => (x.foreignUserId === r.foreignUserId ? { ...x, role: newRole } : x)));
    });
  }

  async function removeRequest(r: RequestGrantItem) {
    const res = await vibeDiyApi.revokeRequest({ appSlug, userSlug, foreignUserId: r.foreignUserId, delete: true });
    toastError(res, () => {
      setRequests((prev) => prev.filter((x) => x.foreignUserId !== r.foreignUserId));
    });
  }

  if (!settings) return null;

  return (
    <ol className="text-sm">
      <RequestsSection
        enableRequest={settings.entry.enableRequest}
        requests={requests}
        toggling={toggling}
        onToggle={() => void toggleEnableRequest()}
        onToggleAutoAccept={() => void toggleAutoAcceptRole()}
        onApprove={(r, role) => void approveRequest(r, role)}
        onRejectPending={(r) => void revokeRequest(r)}
        onRejectApproved={(r) => void revokeRequest(r)}
        onSwitchRole={(r, role) => void switchRequestRole(r, role)}
        onSwitchRejectedRole={(r, role) => void switchRequestRole(r, role)}
        onReApprove={(r) => void approveRequest(r, (r.role ?? "viewer") as "editor" | "viewer")}
        onRemove={(r) => void removeRequest(r)}
        hideHeader={hideHeader}
      />
    </ol>
  );
}

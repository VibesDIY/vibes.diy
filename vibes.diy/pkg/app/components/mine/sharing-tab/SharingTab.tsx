import React, { useEffect, useState } from "react";
import { useVibesDiy } from "../../../vibes-diy-provider.js";
import { toastError } from "./shared.jsx";
import { PublicSharingSection } from "./PublicSharingSection.js";
import { RequestsSection } from "./RequestsSection.js";
import { EmailInvitationsSection } from "./EmailInvitationsSection.js";
import { AppSettings, InviteGrantItem, ResListRequestGrants } from "@vibes.diy/api-types";
import { type RequestGrantItem } from "./shared.js";

interface SharingTabProps {
  userSlug: string;
  appSlug: string;
}

const PAGER = { limit: 100 };

export function SharingTab({ userSlug, appSlug }: SharingTabProps) {
  const { vibeDiyApi } = useVibesDiy();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [invites, setInvites] = useState<InviteGrantItem[]>([]);
  const [requests, setRequests] = useState<ResListRequestGrants["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      vibeDiyApi.ensureAppSettings({ appSlug, userSlug }),
      vibeDiyApi.listInviteGrants({ appSlug, userSlug, pager: PAGER }),
      vibeDiyApi.listRequestGrants({ appSlug, userSlug, pager: PAGER }),
    ])
      .then(([rSettings, rInvites, rRequests]) => {
        toastError(rSettings, (s) => setSettings(s.settings));
        toastError(rInvites, (s) => setInvites(s.items));
        toastError(rRequests, (s) => setRequests(s.items));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, [vibeDiyApi, appSlug, userSlug]);

  async function sendInvite(role: "editor" | "viewer") {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    const res = await vibeDiyApi.createInvite({ appSlug, userSlug, invitedEmail: email, role });
    setInviting(false);
    toastError(res, () => {
      setInviteEmail("");
      void vibeDiyApi.listInviteGrants({ appSlug, userSlug, pager: PAGER }).then((r) => toastError(r, (s) => setInvites(s.items)));
    });
  }

  async function deleteInvite(inv: InviteGrantItem) {
    const res = await vibeDiyApi.revokeInvite({ appSlug, userSlug, emailKey: inv.emailKey, delete: true });
    toastError(res, () => {
      setInvites((prev) => prev.filter((i) => i.emailKey !== inv.emailKey));
    });
  }

  async function revokeInvite(inv: InviteGrantItem) {
    const res = await vibeDiyApi.revokeInvite({ appSlug, userSlug, emailKey: inv.emailKey });
    toastError(res, () => {
      setInvites((prev) => prev.map((i) => (i.emailKey === inv.emailKey ? { ...i, state: "revoked" as const } : i)));
    });
  }

  async function changeInviteRole(inv: InviteGrantItem, newRole: "editor" | "viewer") {
    if (inv.role === newRole) return;
    const res = await vibeDiyApi.inviteSetRole({ appSlug, userSlug, emailKey: inv.emailKey, role: newRole });
    toastError(res, () => {
      setInvites((prev) => prev.map((i) => (i.emailKey === inv.emailKey ? { ...i, role: newRole } : i)));
    });
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

  async function toggleAutoAcceptRole() {
    if (!settings?.entry.enableRequest) return;
    setToggling("autoAcceptRole");
    const currentRole = settings.entry.enableRequest.autoAcceptRole;
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      request: {
        enable: true,
        autoAcceptRole: currentRole ? undefined : "viewer",
      },
    });
    setToggling(null);
    toastError(res, (s) => setSettings(s.settings));
  }

  async function togglePublicAccess(enabled: boolean) {
    setToggling("public");
    const res = await vibeDiyApi.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: !enabled } });
    setToggling(null);
    toastError(res, (s) => setSettings(s.settings));
  }

  async function toggleEnableRequest(enabled: boolean) {
    setToggling("request");
    const res = await vibeDiyApi.ensureAppSettings({ appSlug, userSlug, request: { enable: !enabled } });
    setToggling(null);
    console.log("toggleEnableRequest res:", enabled, res.Ok().settings.entry);
    toastError(res, (s) => setSettings(s.settings));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (!settings) return null;

  const { entry } = settings;

  return (
    <ol className="space-y-5 text-sm">
      <PublicSharingSection
        publicAccess={entry.publicAccess}
        toggling={toggling}
        onToggle={() => void togglePublicAccess(!!entry.publicAccess?.enable)}
      />
      <RequestsSection
        enableRequest={entry.enableRequest}
        requests={requests}
        toggling={toggling}
        onToggle={() => void toggleEnableRequest(!!entry.enableRequest?.enable)}
        onToggleAutoAccept={() => void toggleAutoAcceptRole()}
        onApprove={(r, role) => void approveRequest(r, role)}
        onRejectPending={(r) => void revokeRequest(r)}
        onRejectApproved={(r) => void revokeRequest(r)}
        onSwitchRole={(r, role) => void switchRequestRole(r, role)}
        onSwitchRejectedRole={(r, role) => void switchRequestRole(r, role)}
        onReApprove={(r) => void approveRequest(r, (r.role ?? "viewer") as "editor" | "viewer")}
        onRemove={(r) => void removeRequest(r)}
      />
      <EmailInvitationsSection
        inviteEmail={inviteEmail}
        inviting={inviting}
        invites={invites}
        onEmailChange={setInviteEmail}
        onSendInvite={(role) => void sendInvite(role)}
        onDelete={deleteInvite}
        onRevoke={revokeInvite}
        onChangeRole={changeInviteRole}
      />
    </ol>
  );
}

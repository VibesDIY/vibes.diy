import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useVibesDiy } from "../../../vibes-diy-provider.js";
import { toastError } from "./shared.jsx";
import { PublicSharingSection } from "./PublicSharingSection.js";
import { RequestsSection } from "./RequestsSection.js";
import { EmailInvitationsSection } from "./EmailInvitationsSection.js";
import { ActiveInvite, ActiveRequest, ActiveRequestPending, AppSettings } from "@vibes.diy/api-types";

interface SharingTabProps {
  userSlug: string;
  appSlug: string;
}

export function SharingTab({ userSlug, appSlug }: SharingTabProps) {
  const { vibeDiyApi } = useVibesDiy();
  const { userId } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  function loadSettings() {
    setLoading(true);
    setSettings(null);
    void vibeDiyApi
      .ensureAppSettings({ appSlug, userSlug })
      .then((res) => {
        toastError(res, () => {
          setSettings(res.Ok().settings);
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSettings();
  }, [vibeDiyApi, appSlug, userSlug]);

  async function sendInvite(role: "editor" | "viewer") {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.invite",
          role,
          state: "pending",
          invite: { email, created: new Date() },
          token: "just-a-dummy",
        },
        op: "upsert",
      },
    });
    setInviting(false);
    toastError(res, () => {
      setInviteEmail("");
      setSettings(res.Ok().settings);
    });
  }

  async function deleteInvite(entry: ActiveInvite) {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry, op: "delete" },
    });
    toastError(res, () => {
      setSettings(res.Ok().settings);
    });
  }

  async function changeInviteState(inv: ActiveInvite, newState: "accepted" | "revoked") {
    if (inv.state === "pending") return;
    const entry = { ...inv, state: newState };
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry, op: "upsert" },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function changeInviteRole(inv: ActiveInvite, newRole: "editor" | "viewer") {
    if (inv.role === newRole) return;
    const entry = { ...inv, role: newRole };
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry, op: "upsert" },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function approveRequest(r: ActiveRequestPending, role: "editor" | "viewer") {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.request",
          role,
          state: "approved",
          request: r.request,
          tick: { count: 0, last: new Date() },
          grant: { ownerId: userId ?? userSlug, on: new Date() },
        },
        op: "upsert",
      },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function rejectRequest(r: ActiveRequestPending) {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.request",
          role: r.role,
          state: "rejected",
          request: r.request,
          grant: { ownerId: userId ?? userSlug, on: new Date() },
        },
        op: "upsert",
      },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function switchRequestRole(r: ActiveRequest, newRole: "editor" | "viewer") {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.request",
          role: newRole,
          state: "approved",
          request: r.request,
          tick: { count: 0, last: new Date() },
          grant: { ownerId: userId ?? userSlug, on: new Date() },
        },
        op: "upsert",
      },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function rejectApprovedRequest(r: ActiveRequest) {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.request",
          role: r.role,
          state: "rejected",
          request: r.request,
          grant: { ownerId: userId ?? userSlug, on: new Date() },
        },
        op: "upsert",
      },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function switchRejectedRole(r: ActiveRequest, newRole: "editor" | "viewer") {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.request",
          role: newRole,
          state: "rejected",
          request: r.request,
          grant: { ownerId: userId ?? userSlug, on: new Date() },
        },
        op: "upsert",
      },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function removeRequest(r: ActiveRequest) {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry: r, op: "delete" },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function toggleAutoAcceptViewRequest() {
    if (!settings?.entry.enableRequest) return;
    setToggling("autoAcceptViewRequest");
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          ...settings.entry.enableRequest,
          autoAcceptViewRequest: !settings.entry.enableRequest.autoAcceptViewRequest,
        },
        op: "upsert",
      },
    });
    setToggling(null);
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function toggleFlag(key: string, entryType: "app.acl.enable.public.access" | "app.acl.enable.request", enabled: boolean) {
    if (!settings) return;
    setToggling(key);
    const op = enabled ? "delete" : "upsert";
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: { type: entryType, tick: { count: 0, last: new Date() } },
        op,
      },
    });
    console.log(`Toggling ${entryType} to ${!enabled} with op ${op}`, res);
    setToggling(null);
    toastError(res, () => {
      console.log(`toggleFlag res:`, res.Ok().settings);
      setSettings(res.Ok().settings);
    });
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
  const allRequests: ActiveRequest[] = [...entry.request.pending, ...entry.request.approved, ...entry.request.rejected];
  const allEditorInvites: ActiveInvite[] = [
    ...entry.invite.editors.pending,
    ...entry.invite.editors.accepted,
    ...entry.invite.editors.revoked,
  ];
  const allViewerInvites: ActiveInvite[] = [
    ...entry.invite.viewers.pending,
    ...entry.invite.viewers.accepted,
    ...entry.invite.viewers.revoked,
  ];

  return (
    <ol className="space-y-5 text-sm">
      <PublicSharingSection
        publicAccess={entry.publicAccess}
        toggling={toggling}
        onToggle={() => void toggleFlag("public", "app.acl.enable.public.access", !!entry.publicAccess)}
      />
      <RequestsSection
        enableRequest={entry.enableRequest}
        requests={allRequests}
        toggling={toggling}
        onToggle={() => void toggleFlag("request", "app.acl.enable.request", !!entry.enableRequest)}
        onToggleAutoAccept={() => void toggleAutoAcceptViewRequest()}
        onApprove={(r, role) => void approveRequest(r, role)}
        onRejectPending={(r) => void rejectRequest(r)}
        onRejectApproved={(r) => void rejectApprovedRequest(r)}
        onSwitchRole={(r, role) => void switchRequestRole(r, role)}
        onSwitchRejectedRole={(r, role) => void switchRejectedRole(r, role)}
        onReApprove={(r) => void switchRequestRole(r, r.role)}
        onRemove={(r) => void removeRequest(r)}
      />
      <EmailInvitationsSection
        inviteEmail={inviteEmail}
        inviting={inviting}
        editorInvites={allEditorInvites}
        viewerInvites={allViewerInvites}
        onEmailChange={setInviteEmail}
        onSendInvite={(role) => void sendInvite(role)}
        onDelete={deleteInvite}
        onChangeState={changeInviteState}
        onChangeRole={changeInviteRole}
      />
    </ol>
  );
}

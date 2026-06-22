import { useCallback, useEffect, useState } from "react";
import { useVibesDiy } from "../../../vibes-diy-provider.js";
import { toastError } from "./shared.jsx";
import { type RequestGrantItem } from "./shared.js";
import { AppSettings, InviteGrantItem } from "@vibes.diy/api-types";

const PAGER = { limit: 100 };

export interface UseSharingPanelArgs {
  ownerHandle: string;
  appSlug: string;
  /** Skip all fetches when false. Used by ShareModal to defer requests/invites until the viewer is the owner of a published vibe. */
  enabled?: boolean;
}

export interface UseSharingPanelReturn {
  settings: AppSettings | null;
  invites: InviteGrantItem[];
  requests: RequestGrantItem[];
  loading: boolean;
  toggling: string | null;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviting: boolean;
  refetch: () => void;
  sendInvite: (role: "editor" | "viewer") => Promise<void>;
  deleteInvite: (inv: InviteGrantItem) => Promise<void>;
  revokeInvite: (inv: InviteGrantItem) => Promise<void>;
  changeInviteRole: (inv: InviteGrantItem, newRole: "editor" | "viewer") => Promise<void>;
  approveRequest: (r: RequestGrantItem, role: "editor" | "viewer") => Promise<void>;
  revokeRequest: (r: RequestGrantItem) => Promise<void>;
  switchRequestRole: (r: RequestGrantItem, newRole: "editor" | "viewer") => Promise<void>;
  removeRequest: (r: RequestGrantItem) => Promise<void>;
  togglePublicAccess: (currentlyEnabled: boolean) => Promise<void>;
  toggleEnableRequest: (currentlyEnabled: boolean) => Promise<void>;
  toggleAutoAcceptRole: () => Promise<void>;
}

/**
 * Shared sharing-panel state used by both the App Settings sharing tab and the
 * ShareModal. Owns settings + invites + requests fetch and every handler that
 * mutates them so the two surfaces stay in lockstep.
 */
export function useSharingPanel({ ownerHandle, appSlug, enabled = true }: UseSharingPanelArgs): UseSharingPanelReturn {
  const { sharedApi } = useVibesDiy();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [invites, setInvites] = useState<InviteGrantItem[]>([]);
  const [requests, setRequests] = useState<RequestGrantItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [toggling, setToggling] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const refetch = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    Promise.all([
      sharedApi.ensureAppSettings({ appSlug, ownerHandle }),
      sharedApi.listInviteGrants({ appSlug, ownerHandle, pager: PAGER }),
      sharedApi.listRequestGrants({ appSlug, ownerHandle, pager: PAGER }),
    ])
      .then(([rSettings, rInvites, rRequests]) => {
        toastError(rSettings, (s) => setSettings(s.settings));
        toastError(rInvites, (s) => setInvites(s.items));
        toastError(rRequests, (s) => setRequests(s.items));
      })
      .finally(() => setLoading(false));
  }, [enabled, sharedApi, appSlug, ownerHandle]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const sendInvite = useCallback(
    async (role: "editor" | "viewer") => {
      const email = inviteEmail.trim();
      if (!email) return;
      setInviting(true);
      const res = await sharedApi.createInvite({ appSlug, ownerHandle, invitedEmail: email, role });
      setInviting(false);
      toastError(res, () => {
        setInviteEmail("");
        void sharedApi
          .listInviteGrants({ appSlug, ownerHandle, pager: PAGER })
          .then((r) => toastError(r, (s) => setInvites(s.items)));
      });
    },
    [sharedApi, appSlug, ownerHandle, inviteEmail]
  );

  const deleteInvite = useCallback(
    async (inv: InviteGrantItem) => {
      const res = await sharedApi.revokeInvite({ appSlug, ownerHandle, emailKey: inv.emailKey, delete: true });
      toastError(res, () => {
        setInvites((prev) => prev.filter((i) => i.emailKey !== inv.emailKey));
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const revokeInvite = useCallback(
    async (inv: InviteGrantItem) => {
      const res = await sharedApi.revokeInvite({ appSlug, ownerHandle, emailKey: inv.emailKey });
      toastError(res, () => {
        setInvites((prev) => prev.map((i) => (i.emailKey === inv.emailKey ? { ...i, state: "revoked" as const } : i)));
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const changeInviteRole = useCallback(
    async (inv: InviteGrantItem, newRole: "editor" | "viewer") => {
      if (inv.role === newRole) return;
      const res = await sharedApi.inviteSetRole({ appSlug, ownerHandle, emailKey: inv.emailKey, role: newRole });
      toastError(res, () => {
        setInvites((prev) => prev.map((i) => (i.emailKey === inv.emailKey ? { ...i, role: newRole } : i)));
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const approveRequest = useCallback(
    async (r: RequestGrantItem, role: "editor" | "viewer") => {
      const res = await sharedApi.approveRequest({ appSlug, ownerHandle, foreignUserId: r.foreignUserId, role });
      toastError(res, () => {
        setRequests((prev) =>
          prev.map((x) => (x.foreignUserId === r.foreignUserId ? { ...x, state: "approved" as const, role } : x))
        );
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const revokeRequest = useCallback(
    async (r: RequestGrantItem) => {
      const res = await sharedApi.revokeRequest({ appSlug, ownerHandle, foreignUserId: r.foreignUserId });
      toastError(res, () => {
        setRequests((prev) => prev.map((x) => (x.foreignUserId === r.foreignUserId ? { ...x, state: "revoked" as const } : x)));
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const switchRequestRole = useCallback(
    async (r: RequestGrantItem, newRole: "editor" | "viewer") => {
      const res = await sharedApi.requestSetRole({ appSlug, ownerHandle, foreignUserId: r.foreignUserId, role: newRole });
      toastError(res, () => {
        setRequests((prev) => prev.map((x) => (x.foreignUserId === r.foreignUserId ? { ...x, role: newRole } : x)));
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const removeRequest = useCallback(
    async (r: RequestGrantItem) => {
      const res = await sharedApi.revokeRequest({ appSlug, ownerHandle, foreignUserId: r.foreignUserId, delete: true });
      toastError(res, () => {
        setRequests((prev) => prev.filter((x) => x.foreignUserId !== r.foreignUserId));
      });
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const togglePublicAccess = useCallback(
    async (currentlyEnabled: boolean) => {
      setToggling("public");
      const res = await sharedApi.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: !currentlyEnabled } });
      setToggling(null);
      toastError(res, (s) => setSettings(s.settings));
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const toggleEnableRequest = useCallback(
    async (currentlyEnabled: boolean) => {
      setToggling("request");
      const res = await sharedApi.ensureAppSettings({ appSlug, ownerHandle, request: { enable: !currentlyEnabled } });
      setToggling(null);
      toastError(res, (s) => setSettings(s.settings));
    },
    [sharedApi, appSlug, ownerHandle]
  );

  const toggleAutoAcceptRole = useCallback(async () => {
    if (!settings?.entry.enableRequest) return;
    setToggling("autoAcceptRole");
    const currentRole = settings.entry.enableRequest.autoAcceptRole;
    const res = await sharedApi.ensureAppSettings({
      appSlug,
      ownerHandle,
      request: { enable: true, autoAcceptRole: currentRole ? undefined : "editor" },
    });
    setToggling(null);
    toastError(res, (s) => setSettings(s.settings));
  }, [sharedApi, appSlug, ownerHandle, settings]);

  return {
    settings,
    invites,
    requests,
    loading,
    toggling,
    inviteEmail,
    setInviteEmail,
    inviting,
    refetch,
    sendInvite,
    deleteInvite,
    revokeInvite,
    changeInviteRole,
    approveRequest,
    revokeRequest,
    switchRequestRole,
    removeRequest,
    togglePublicAccess,
    toggleEnableRequest,
    toggleAutoAcceptRole,
  };
}

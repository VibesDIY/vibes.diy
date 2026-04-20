import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/react";
import { useParams } from "react-router";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { isUserSettingSharing, type UserSettingSharing } from "@vibes.diy/api-types";
import type { ResOkVibeRegisterFPDb } from "@vibes.diy/vibe-types";
import { toast } from "react-hot-toast";

export type DbRef = ResOkVibeRegisterFPDb["data"];

export type SharingState = "allowed" | "denied" | "waiting" | "ask" | "notSignedIn";

export type SharingResult =
  | { status: "login-declined" }
  | { status: "accepted"; dbRef: DbRef }
  | { status: "declined"; dbRef: DbRef };

export function useShareableDB() {
  const { srvVibeSandbox, vibeDiyApi } = useVibesDiy();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const { userSlug: routeUserSlug, appSlug: routeAppSlug } = useParams<{ userSlug: string; appSlug: string }>();

  const [pendingDbRef, setPendingDbRef] = useState<ReturnType<typeof srvVibeSandbox.shareableDBs.get> | null>(null);
  const pendingDbRefRef = useRef<ReturnType<typeof srvVibeSandbox.shareableDBs.get> | null>(null);
  const [sharingState, setSharingState] = useState<SharingState | null>(null);
  const currentSharingRef = useRef<UserSettingSharing | undefined>(undefined);

  // Keep ref in sync so onResult can read it without stale closure
  useEffect(() => {
    pendingDbRefRef.current = pendingDbRef;
  }, [pendingDbRef]);

  // Listen for new shareable DBs from the sandbox
  useEffect(() => {
    return srvVibeSandbox.shareableDBs.onSet((_k, v, meta) => {
      if (!meta.update) {
        setPendingDbRef(v);
        console.log(`New shareable DB registered:`, { key: _k, value: v, meta });
      }
    });
  }, [srvVibeSandbox]);

  // Auto-allow same-vibe DB registrations without prompting
  const isSameVibe = pendingDbRef
    ? pendingDbRef.data.appSlug === routeAppSlug && pendingDbRef.data.userSlug === routeUserSlug
    : false;

  // Compute sharingState whenever pendingDbRef or auth status changes
  useEffect(() => {
    if (!pendingDbRef) {
      setSharingState(null);
      return;
    }

    // Same-vibe DB: auto-allow without user prompt or settings check
    if (isSameVibe) {
      const v = pendingDbRefRef.current;
      if (v) {
        srvVibeSandbox.shareableDBs.set(v.key, { ...v, attachAction: "attach" });
      }
      setSharingState("allowed");
      return;
    }

    // Cross-vibe DB: require authentication and explicit consent
    if (!isLoaded) {
      setSharingState("waiting");
      return;
    }
    if (!isSignedIn) {
      setSharingState("notSignedIn");
      return;
    }
    setSharingState("waiting");
    void vibeDiyApi.ensureUserSettings({ settings: [] }).then((res) => {
      if (res.isErr()) {
        toast.error(`Failed to load user settings: ${res.Err()}`);
        return;
      }
      const sharing = res.isOk() ? res.Ok().settings.find(isUserSettingSharing) : undefined;
      currentSharingRef.current = sharing;
      const { dbName, appSlug, userSlug } = pendingDbRef.data;
      const grant = sharing?.grants.find(
        (g) => (g.dbName === "*" || g.dbName === dbName) && g.appSlug === appSlug && g.userSlug === userSlug
      );
      if (grant?.grant === "allow") {
        const v = pendingDbRefRef.current;
        if (v) {
          srvVibeSandbox.shareableDBs.set(v.key, { ...v, attachAction: "attach" });
        }
        setSharingState("allowed");
      } else if (grant?.grant === "deny") {
        setSharingState("denied");
      } else {
        setSharingState("ask");
      }
    });
  }, [pendingDbRef, isLoaded, isSignedIn, vibeDiyApi, isSameVibe]);

  // Auto-clear "allowed"/"denied" — existing grant, no dialog needed
  useEffect(() => {
    if (sharingState === "allowed" || sharingState === "denied") {
      setPendingDbRef(null);
    }
  }, [sharingState]);

  // Auto-dismiss "notSignedIn" after 5 seconds
  useEffect(() => {
    if (sharingState !== "notSignedIn") return;
    const timer = setTimeout(() => setPendingDbRef(null), 5000);
    return () => clearTimeout(timer);
  }, [sharingState]);

  // Called by the component when the user makes an explicit decision
  const onResult = useCallback(
    (result: SharingResult) => {
      if (result.status === "accepted" || result.status === "declined") {
        const { appSlug, userSlug, dbName } = result.dbRef;
        const newGrant = {
          grant: result.status === "accepted" ? ("allow" as const) : ("deny" as const),
          appSlug,
          userSlug,
          dbName,
        };
        // Merge with existing grants, replacing any for the same db
        const filteredGrants =
          currentSharingRef.current?.grants.filter(
            (g) => !(g.appSlug === appSlug && g.userSlug === userSlug && (g.dbName === dbName || g.dbName === "*"))
          ) ?? [];
        void vibeDiyApi.ensureUserSettings({
          settings: [{ type: "sharing", grants: [...filteredGrants, newGrant] }],
        });
      }
      setPendingDbRef(null);
    },
    [vibeDiyApi, srvVibeSandbox]
  );

  const onDismiss = useCallback(() => {
    setPendingDbRef(null);
  }, []);

  const onLoginRedirect = useCallback(() => {
    void clerk.redirectToSignIn({ redirectUrl: window.location.href });
  }, [clerk]);

  return {
    sharingState,
    dbRef: pendingDbRef?.data ?? null,
    onResult,
    onDismiss,
    onLoginRedirect,
  };
}

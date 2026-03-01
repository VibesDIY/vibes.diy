import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { isUserSettingSharing, type UserSettingItem, type VibesDiyApiIface } from "@vibes.diy/api-types";
import type { ResOkVibeRegisterFPDb } from "@vibes.diy/vibe-types";
import { toast } from "react-hot-toast";

export type DbRef = ResOkVibeRegisterFPDb["data"];

export type SharingState = "allowed" | "denied" | "waiting" | "ask" | "notSignedIn";

export type SharingResult =
  | { status: "login-declined" }
  | { status: "accepted"; dbRef: DbRef }
  | { status: "declined"; dbRef: DbRef };

export interface RouteContext {
  readonly userSlug: string;
  readonly appSlug: string;
}

export interface SharingGrant {
  readonly grant: "allow" | "deny";
  readonly appSlug: string;
  readonly userSlug: string;
  readonly dbName: string;
}

export function mergeSharingGrants(existingSharing: UserSettingItem | undefined, grant: SharingGrant) {
  const filteredGrants =
    existingSharing?.grants.filter(
      (g) => !(g.appSlug === grant.appSlug && g.userSlug === grant.userSlug && (g.dbName === grant.dbName || g.dbName === "*"))
    ) ?? [];
  return [...filteredGrants, grant];
}

export async function saveSharingGrant(params: {
  readonly vibeDiyApi: Pick<VibesDiyApiIface, "ensureUserSettings">;
  readonly grant: SharingGrant;
  readonly existingSharing: UserSettingItem | undefined;
  readonly onError: (message: string) => void;
  readonly onSaved: (sharing: UserSettingItem | undefined) => void;
}): Promise<void> {
  const rSave = await params.vibeDiyApi.ensureUserSettings({
    settings: [{ type: "sharing", grants: mergeSharingGrants(params.existingSharing, params.grant) }],
  });
  if (rSave.isErr()) {
    params.onError(`Failed to save sharing settings: ${rSave.Err()}`);
    return;
  }
  params.onSaved(rSave.Ok().settings.find(isUserSettingSharing));
}

export function useShareableDB(routeContext?: RouteContext) {
  const { srvVibeSandbox, vibeDiyApi } = useVibeDiy();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const routeAppSlug = routeContext?.appSlug;
  const routeUserSlug = routeContext?.userSlug;

  const [pendingDbRef, setPendingDbRef] = useState<ReturnType<typeof srvVibeSandbox.shareableDBs.get> | null>(null);
  const pendingDbRefRef = useRef<ReturnType<typeof srvVibeSandbox.shareableDBs.get> | null>(null);
  const [sharingState, setSharingState] = useState<SharingState | null>(null);
  const currentSharingRef = useRef<UserSettingItem | undefined>(undefined);

  const persistGrant = useCallback(
    (grant: SharingGrant, existingSharing?: UserSettingItem) => {
      void saveSharingGrant({
        vibeDiyApi,
        grant,
        existingSharing,
        onError: (message) => toast.error(message),
        onSaved: (sharing) => {
          currentSharingRef.current = sharing;
        },
      });
    },
    [vibeDiyApi]
  );

  // Keep ref in sync so onResult can read it without stale closure
  useEffect(() => {
    pendingDbRefRef.current = pendingDbRef;
  }, [pendingDbRef]);

  // Listen for new shareable DBs from the sandbox
  useEffect(() => {
    return srvVibeSandbox.shareableDBs.onSet((_k, v, meta) => {
      console.log(`New shareable DB registered:`, { key: _k, value: v, meta });
      if (!meta.update) setPendingDbRef(v);
    });
  }, [srvVibeSandbox]);

  // Compute sharingState whenever pendingDbRef or auth status changes
  useEffect(() => {
    // console.log(`Computing sharing state for pendingDbRef:`, pendingDbRef, isLoaded, isSignedIn);
    if (!pendingDbRef) {
      setSharingState(null);
      return;
    }
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
        // Same-app auto-allow: when the DB's identity matches the current route,
        // the user is already on this app's page — no dialog needed.
        const isSameApp = routeAppSlug === appSlug && routeUserSlug === userSlug;
        if (isSameApp) {
          persistGrant({ grant: "allow", appSlug, userSlug, dbName }, sharing);
          const v = pendingDbRefRef.current;
          if (v) {
            srvVibeSandbox.shareableDBs.set(v.key, { ...v, attachAction: "attach" });
          }
          setSharingState("allowed");
        } else {
          // Cross-app access: show the dialog
          setSharingState("ask");
        }
      }
    });
  }, [pendingDbRef, isLoaded, isSignedIn, vibeDiyApi, routeAppSlug, routeUserSlug, persistGrant, srvVibeSandbox]);

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
        persistGrant(newGrant, currentSharingRef.current);
      }
      setPendingDbRef(null);
    },
    [persistGrant]
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

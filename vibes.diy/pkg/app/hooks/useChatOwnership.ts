import { useEffect, useRef, useState } from "react";
import type { Conn } from "@vibes.diy/api-types";

export interface ChatOwnershipOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly isSignedIn: boolean | undefined;
  readonly sharedApi: Conn<"shared">;
  // The share modal's open state — closing it re-fetches the pending count so a
  // grant approved inside the modal is reflected in the header badge.
  readonly shareModalOpen: boolean;
}

export interface ChatOwnership {
  readonly isOwner: boolean;
  readonly pendingCount: number;
}

/**
 * Owns the chat route's ownership + pending-grant data loading: the owner
 * lookup, the pending-request count, the live grant subscription, and the
 * share-modal-close refresh bump. Self-contained — behavior-preserving
 * extraction from the Chat component (VibesDIY/vibes.diy#2015).
 */
export function useChatOwnership(opts: ChatOwnershipOpts): ChatOwnership {
  const { ownerHandle, appSlug, isSignedIn, sharedApi, shareModalOpen } = opts;
  const [isOwner, setIsOwner] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBump, setPendingBump] = useState(0);

  useEffect(() => {
    if (!isSignedIn || !ownerHandle) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    void sharedApi.listHandleBindings({}).then((res) => {
      if (cancelled) return;
      if (res.isErr()) {
        setIsOwner(false);
        return;
      }
      setIsOwner(res.Ok().items.some((item) => item.ownerHandle === ownerHandle));
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, ownerHandle, sharedApi]);

  useEffect(() => {
    if (!isOwner || !ownerHandle || !appSlug) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    void sharedApi.listRequestGrants({ appSlug, ownerHandle, pager: { limit: 100 } }).then((res) => {
      if (cancelled || res.isErr()) return;
      setPendingCount(res.Ok().items.filter((r) => r.state === "pending").length);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, ownerHandle, appSlug, sharedApi, pendingBump]);

  useEffect(() => {
    if (!isOwner || !ownerHandle || !appSlug) {
      return;
    }
    void sharedApi.subscribeRequestGrants({ appSlug, ownerHandle });
    const unsubscribe = sharedApi.onRequestGrant((evt) => {
      if (evt.grant.ownerHandle === ownerHandle && evt.grant.appSlug === appSlug) {
        setPendingBump((n) => n + 1);
      }
    });
    return unsubscribe;
  }, [isOwner, ownerHandle, appSlug, sharedApi]);

  const prevShareOpenRef = useRef(shareModalOpen);
  useEffect(() => {
    if (prevShareOpenRef.current && !shareModalOpen) {
      setPendingBump((n) => n + 1);
    }
    prevShareOpenRef.current = shareModalOpen;
  }, [shareModalOpen]);

  return { isOwner, pendingCount };
}

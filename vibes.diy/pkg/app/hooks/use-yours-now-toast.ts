import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { toast } from "react-hot-toast";

/**
 * Shows the one-time "it's yours now" message (#1856) after a non-owner makes a
 * vibe theirs. The remix/clone fork landing carries a `?yours=1` flag; this fires
 * the message once and scrubs the flag from the URL (so a refresh/back doesn't
 * repeat it). Used by the two landing routes — /chat (remix-with-prompt) and /vibe
 * (clone). `remixOf` is the *permanent* lineage marker; this flag is the *transient*
 * "just now" signal, which is why it can't key off remixOf.
 */
export function useYoursNowToast(): void {
  const [params, setParams] = useSearchParams();
  const firedRef = useRef(false);
  useEffect(() => {
    if (params.get("yours") !== "1") return;
    if (!firedRef.current) {
      firedRef.current = true;
      toast.success("It's yours now — the original is unchanged.", { id: "made-it-yours", duration: 6000 });
    }
    // Scrub the flag (idempotent; retried if a concurrent param update raced it).
    const next = new URLSearchParams(params);
    next.delete("yours");
    setParams(next, { replace: true });
  }, [params, setParams]);
}

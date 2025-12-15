import { useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { trackAuthClick } from "../utils/analytics.js";

export function useAuthPopup() {
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const clerk = useClerk();

  const initiateLogin = async () => {
    trackAuthClick();
    setIsPolling(true);
    setPollError(null);

    try {
      // Use Clerk's openSignIn method
      await clerk.openSignIn({});
      setIsPolling(false);
    } catch (err) {
      setIsPolling(false);
      setPollError("An error occurred during log in.");
      console.error("Login error:", err);
    }
  };

  return {
    isPolling,
    pollError,
    initiateLogin,
  };
}

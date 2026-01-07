import { useState } from "react";
import { initiateAuthFlow, pollForAuthToken } from "../utils/auth.js";
import { useAuth } from "../contexts/AuthContext.js";
import { trackAuthClick } from "../utils/analytics.js";

export function useAuthPopup() {
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const { processToken } = useAuth();

  const initiateLogin = async () => {
    trackAuthClick();
    const auth = initiateAuthFlow();

    if (auth && auth.connectUrl && auth.resultId) {
      const popupWidth = 600;
      const popupHeight = 700;
      const left = window.screenX + (window.outerWidth - popupWidth) / 2;
      const top = window.screenY + (window.outerHeight - popupHeight) / 2;
      const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes`;

      window.open(auth.connectUrl, "authPopup", popupFeatures);
      setIsPolling(true);
      setPollError(null);

      try {
        const token = await pollForAuthToken(auth.resultId);
        setIsPolling(false);
        if (token) {
          processToken(token);
        } else {
          setPollError("Log in timed out. Please try again.");
        }
      } catch (err) {
        setIsPolling(false);
        setPollError("An error occurred during log in.");
      }
    } else {
      console.warn("Authentication flow could not be initiated.");
      setPollError("Could not initiate authentication.");
    }
  };

  return {
    isPolling,
    pollError,
    initiateLogin,
  };
}

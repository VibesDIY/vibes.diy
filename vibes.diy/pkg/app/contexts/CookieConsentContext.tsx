import React, { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface CookieConsentContextType {
  messageHasBeenSent: boolean;
  setMessageHasBeenSent: (value: boolean) => void;
}

const CookieConsentContext = createContext<
  CookieConsentContextType | undefined
>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [messageHasBeenSent, setMessageHasBeenSent] = useState(false);

  return (
    <CookieConsentContext.Provider
      value={{ messageHasBeenSent, setMessageHasBeenSent }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error(
      "useCookieConsent must be used within a CookieConsentProvider",
    );
  }
  return context;
}

import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect, useRef } from "react";

const MobileCtx = createContext(false);

export const useMobile = () => useContext(MobileCtx);

export function MobileProvider({
  children,
  bp = 640,
}: {
  children: ReactNode;
  bp?: number;
}) {
  const mqRef = useRef(
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${bp - 1}px)`)
      : null
  );
  const [m, setM] = useState(mqRef.current ? mqRef.current.matches : false);

  useEffect(() => {
    const mq = mqRef.current;
    if (!mq) return;
    setM(mq.matches);
    const h = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let meta = document.querySelector(
      'meta[name="viewport"]'
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content =
      "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no";
  }, []);

  return <MobileCtx.Provider value={m}>{children}</MobileCtx.Provider>;
}

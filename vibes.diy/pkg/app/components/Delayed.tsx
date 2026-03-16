import React, { useEffect, useState } from "react";

interface DelayedProps {
  ms: number;
  children: React.ReactNode;
}

export function Delayed({ ms, children }: DelayedProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return show ? <>{children}</> : null;
}

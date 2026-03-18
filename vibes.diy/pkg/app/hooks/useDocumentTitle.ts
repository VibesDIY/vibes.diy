import { useCallback, useEffect, useRef } from "react";

export function useDocumentTitle(defaultTitle?: string) {
  const prevTitle = useRef<string | undefined>(undefined);

  useEffect(() => {
    prevTitle.current = document.title;
    if (defaultTitle) document.title = defaultTitle;
    return () => {
      if (prevTitle.current !== undefined) document.title = prevTitle.current;
    };
  }, [defaultTitle]);

  return useCallback((title: string) => {
    document.title = title;
  }, []);
}

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    window.addEventListener("bazaar:navigate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("bazaar:navigate", onPop);
    };
  }, []);

  return path;
}

export function navigate(to: string) {
  return (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (window.location.pathname === to) return;
    window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("bazaar:navigate"));
    window.scrollTo({ top: 0 });
  };
}

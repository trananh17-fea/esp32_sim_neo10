import { useEffect, useRef } from "react";

/**
 * Focuses the returned ref's element when the URL hash matches the given anchor.
 * Useful for auto-focusing form inputs when navigating via anchor links.
 */
export function useAnchorFocus<T extends HTMLElement>(anchor: string): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const focusIfMatch = (): void => {
      if (window.location.hash === anchor) {
        window.setTimeout(() => ref.current?.focus(), 250);
      }
    };

    focusIfMatch();
    window.addEventListener("hashchange", focusIfMatch);
    return () => window.removeEventListener("hashchange", focusIfMatch);
  }, [anchor]);

  return ref;
}
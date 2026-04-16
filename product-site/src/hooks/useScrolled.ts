import { useEffect, useState } from "react";

/**
 * Returns true when window.scrollY exceeds the given threshold.
 * Uses a passive scroll listener for performance.
 */
export function useScrolled(threshold: number = 16): boolean {
  const [scrolled, setScrolled] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setScrolled(window.scrollY > threshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolled;
}
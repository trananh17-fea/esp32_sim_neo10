import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref and a boolean `inView`.
 * Once the element enters the viewport it stays `true` (fire-once).
 */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return [ref, inView];
}
"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-spy: the section crossing a thin band near the top of the viewport is "current".
 * Starts as null so server and client render the same markup; it's only set after mount.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        // Between two sections nothing is in the band; keep the previous one highlighted.
        const current = ids.find((id) => visible.get(id));
        if (current) setActive(current);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

"use client";

import { useEffect, useRef } from "react";

export function useAdaptivePoll(
  fn: () => Promise<boolean>,
  fastMs: number,
  slowMs: number,
  active: boolean = true,
) {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      const running = await fnRef.current();
      timer = setTimeout(tick, running ? fastMs : slowMs);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fastMs, slowMs, active]);
}

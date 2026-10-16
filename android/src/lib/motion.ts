import { useEffect, useRef, useState } from 'react';

/** CSS-style cubic Bézier easing, e.g. bezier(0.65, 0, 0.25, 1). */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

/** The curves used across the opening and welcome screens. */
export const ease = {
  /** Slow start, long soft landing: the reveal through the logo. */
  reveal: bezier(0.65, 0, 0.25, 1),
  /** Quick out, gentle settle: things arriving. */
  out: bezier(0.22, 1, 0.36, 1),
  inOut: bezier(0.45, 0, 0.55, 1),
};

/** Progress (0…1) of `t` within [start, start + duration], eased. */
export function phase(t: number, start: number, duration: number, curve: (x: number) => number = ease.out) {
  return curve(Math.min(1, Math.max(0, (t - start) / duration)));
}

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Animation time in ms since `running` turned true, re-rendering on every frame until `total`, then calls
 * `onEnd`. For short, one-off animations drawn with react-native-svg. Each frame advances the clock by at most
 * 50 ms, so when the JS thread is busy (as it is while the app starts on a slow phone) the animation slows
 * down instead of jumping straight to its end.
 */
export function useClock(running: boolean, total: number, onEnd?: () => void) {
  const [t, setT] = useState(0);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;
    const tick = (now: number) => {
      if (last != null) elapsed += Math.min(now - last, 50);
      last = now;
      setT(Math.min(elapsed, total));
      if (elapsed < total) raf = requestAnimationFrame(tick);
      else end.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, total]);
  return t;
}

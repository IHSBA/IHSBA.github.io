import { useEffect, useRef } from 'react';

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Generous bottom margin so the observer fires *before* an element is
// fully in view -- a fast flick-scroll can otherwise jump an element
// past the viewport between animation frames without ever crossing a
// 0.12/0.5 threshold, leaving it permanently stuck at opacity: 0.
const EARLY_TRIGGER_MARGIN = '0px 0px 15% 0px';
// Belt-and-suspenders: if the observer never fires for some reason
// (backgrounded tab throttling, an edge case in a given browser), force
// the reveal/count-up after a short delay so content can never be
// permanently invisible.
const FALLBACK_MS = 2000;

// Scroll-triggered reveal: attach the returned ref to any element and it
// fades/slides in the first time it enters the viewport.
export function useReveal(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      el.classList.add('revealed');
      return undefined;
    }
    const reveal = () => {
      el.style.transitionDelay = `${delay}ms`;
      el.classList.add('revealed');
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.01, rootMargin: EARLY_TRIGGER_MARGIN }
    );
    io.observe(el);
    const fallback = setTimeout(() => {
      if (!el.classList.contains('revealed')) reveal();
    }, FALLBACK_MS);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, [delay]);
  return ref;
}

// Count-up animation for a KPI number. `target` is the final numeric
// value; `decimals` and `rate` (drop leading 0, baseball-style) match
// the display format.
export function useCountUp(target, { decimals = 0, rate = false } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const format = (v) => {
      let s = v.toFixed(decimals);
      if (rate && v < 1) s = s.replace(/^0/, '');
      return s;
    };
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      el.textContent = format(target);
      return undefined;
    }
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      const duration = 900;
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = format(target * eased);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          run();
          io.unobserve(el);
        });
      },
      { threshold: 0.01, rootMargin: EARLY_TRIGGER_MARGIN }
    );
    io.observe(el);
    const fallback = setTimeout(run, FALLBACK_MS);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, [target, decimals, rate]);
  return ref;
}

// Lightweight pointermove 3D tilt using CSS custom properties. No-op for
// reduced-motion and touch (no hover) users.
export function useTilt() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion) return undefined;
    const canHover = window.matchMedia('(hover: hover)').matches;
    if (!canHover) return undefined;
    const max = 8;
    function move(e) {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty('--rx', `${-(py - 0.5) * 2 * max}deg`);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    }
    function reset() {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
    };
  }, []);
  return ref;
}

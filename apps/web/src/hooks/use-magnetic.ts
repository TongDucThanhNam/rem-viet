import { useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

export function useMagnetic() {
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rect: DOMRect | null = null;

    const handleMouseEnter = () => {
      rect = el.getBoundingClientRect();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!rect) {
        rect = el.getBoundingClientRect();
      }
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set((e.clientX - centerX) * 0.3);
      y.set((e.clientY - centerY) * 0.3);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
      rect = null;
    };

    el.addEventListener("mouseenter", handleMouseEnter);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mouseenter", handleMouseEnter);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [x, y]);

  return { ref, x: springX, y: springY };
}

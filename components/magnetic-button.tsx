"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Maximum pixel pull when cursor is at the edge of the magnetic zone */
  strength?: number;
  /** Distance in px around the button where magnetism activates */
  radius?: number;
  children: React.ReactNode;
}

/**
 * Primary CTA that subtly pulls toward the cursor when within `radius` px.
 * Disabled on touch devices and when the user prefers reduced motion.
 * Use only on the highest-value buttons (1-2 per page).
 */
export function MagneticButton({
  strength = 6,
  radius = 80,
  className,
  children,
  ...props
}: MagneticButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18 });
  const springY = useSpring(y, { stiffness: 220, damping: 18 });
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;
    // Skip magnetism on touch devices (no mouse)
    const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
    if (isTouch) return;

    const onMouseMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius + Math.max(rect.width, rect.height) / 2) {
        const pullFactor = Math.max(0, 1 - dist / (radius * 2));
        x.set(dx * pullFactor * (strength / radius));
        y.set(dy * pullFactor * (strength / radius));
      } else {
        x.set(0);
        y.set(0);
      }
    };
    const onMouseLeave = () => {
      x.set(0);
      y.set(0);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [radius, strength, x, y, reduced]);

  return (
    <motion.button
      ref={ref}
      style={reduced ? undefined : { x: springX, y: springY }}
      className={cn("relative", className)}
      whileTap={{ scale: 0.96 }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

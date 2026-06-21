import React, { useRef, useEffect, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, useSpring, MotionValue } from 'framer-motion';

export const CanvasContext = React.createContext<{ x: MotionValue<number>, y: MotionValue<number> } | null>(null);

interface InfiniteCanvasProps {
  children: React.ReactNode;
}

export function InfiniteCanvas({ children }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Springs — slightly tighter for crisp drag response
  const x = useSpring(0, { stiffness: 120, damping: 26, mass: 0.6 });
  const y = useSpring(0, { stiffness: 120, damping: 26, mass: 0.6 });

  // Inertia state
  const velX = useRef(0);
  const velY = useRef(0);
  const rafId = useRef<number | null>(null);
  const lastWheelTime = useRef(0);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const getBounds = useCallback(() => {
    if (!containerRef.current || !gridRef.current) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const viewportWidth = containerRef.current.clientWidth;
    const viewportHeight = containerRef.current.clientHeight;
    const gridWidth = gridRef.current.scrollWidth;
    const gridHeight = gridRef.current.scrollHeight;
    const minX = Math.min(0, viewportWidth - gridWidth);
    const maxX = 0;
    const minY = Math.min(0, viewportHeight - gridHeight);
    const maxY = 0;
    return { minX, maxX, minY, maxY };
  }, []);

  // rAF-based inertia loop — decays velocity each frame until negligible
  const startInertia = useCallback(() => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);

    const FRICTION = 0.93; // higher = more glide, lower = snappier stop
    const MIN_VEL = 0.3;   // stop threshold in px

    const loop = () => {
      velX.current *= FRICTION;
      velY.current *= FRICTION;

      if (Math.abs(velX.current) < MIN_VEL && Math.abs(velY.current) < MIN_VEL) {
        velX.current = 0;
        velY.current = 0;
        rafId.current = null;
        return;
      }

      const { minX, maxX, minY, maxY } = getBounds();
      x.set(clamp(x.get() + velX.current, minX, maxX));
      y.set(clamp(y.get() + velY.current, minY, maxY));

      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);
  }, [getBounds, x, y]);

  // Handle gestures
  useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => {
        // Cancel any active inertia when user grabs the canvas
        if (rafId.current !== null) {
          cancelAnimationFrame(rafId.current);
          rafId.current = null;
        }
        x.set(dx);
        y.set(dy);
      },
      onDragEnd: ({ offset: [dx, dy], velocity: [vx, vy], direction: [dirX, dirY] }) => {
        const { minX, maxX, minY, maxY } = getBounds();
        const rawTargetX = dx + (vx * dirX * 220);
        const rawTargetY = dy + (vy * dirY * 220);
        x.set(clamp(rawTargetX, minX, maxX));
        y.set(clamp(rawTargetY, minY, maxY));
      },
      onWheel: ({ event, delta: [dx, dy] }) => {
        event.preventDefault();

        // Normalize: trackpad sends small deltas (1-10px), mouse wheel sends large (100px+)
        // Cap individual delta so mouse wheel doesn't feel hyper-sensitive
        const now = Date.now();
        const timeDelta = now - lastWheelTime.current;
        lastWheelTime.current = now;

        // If events come very fast (< 30ms apart) it's a trackpad — use raw delta
        // If events are slow/chunky (> 80ms apart) it's a mouse wheel — dampen it
        const isMouseWheel = timeDelta > 80;
        const scale = isMouseWheel ? 0.35 : 1.0;

        // Accumulate into velocity
        velX.current -= dx * scale;
        velY.current -= dy * scale;

        // Clamp max velocity so fast swipes don't overshoot
        const MAX_VEL = 80;
        velX.current = clamp(velX.current, -MAX_VEL, MAX_VEL);
        velY.current = clamp(velY.current, -MAX_VEL, MAX_VEL);

        // Start/restart the inertia loop
        startInertia();
      }
    },
    {
      target: containerRef,
      drag: {
        from: () => [x.get(), y.get()],
        bounds: () => {
          const { minX, maxX, minY, maxY } = getBounds();
          return { left: minX, right: maxX, top: minY, bottom: maxY };
        },
        rubberband: 0.15
      },
      wheel: {
        eventOptions: { passive: false }
      }
    }
  );

  // Prevent default touch behaviors (pull-to-refresh, etc.)
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventDefault);
    document.addEventListener('gesturechange', preventDefault);
    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      // Clean up any running rAF on unmount
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <CanvasContext.Provider value={{ x, y }}>
      <div
        ref={containerRef}
        className="fixed inset-0 cursor-grab active:cursor-grabbing touch-none overflow-hidden bg-[#fbfaf5] dark:bg-[#161616] transition-colors duration-700"
      >
        <motion.div
          ref={gridRef}
          className="absolute top-0 left-0 will-change-transform"
          style={{ x, y }}
        >
          {children}
        </motion.div>
      </div>
    </CanvasContext.Provider>
  );
}

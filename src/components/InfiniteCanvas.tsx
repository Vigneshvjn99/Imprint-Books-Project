import React, { useRef, useEffect, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, useSpring, MotionValue } from 'framer-motion';

export const CanvasContext = React.createContext<{ x: MotionValue<number>, y: MotionValue<number> } | null>(null);

interface InfiniteCanvasProps {
  children: React.ReactNode;
}

// Rubber-band formula: allows slight overshoot past edges with resistance.
// The further past the bound, the more resistance is applied.
// coeff controls how elastic the stretch feels (0 = wall, 1 = no resistance)
const rubberband = (pos: number, bound: number, coeff: number): number => {
  // pos is already within bounds — no effect
  if (coeff === 0) return pos;
  const overshoot = pos - bound;
  // Apple's rubber-band formula: overshoot reduces logarithmically
  return bound + (overshoot * coeff) / (1 + Math.abs(overshoot) * 0.008);
};

const applyRubberband = (
  pos: number,
  min: number,
  max: number,
  coeff = 0.4
): number => {
  if (pos < min) return rubberband(pos, min, coeff);
  if (pos > max) return rubberband(pos, max, coeff);
  return pos;
};

export function InfiniteCanvas({ children }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Springs — tight and responsive for both drag and scroll
  const x = useSpring(0, { stiffness: 200, damping: 28, mass: 0.4 });
  const y = useSpring(0, { stiffness: 200, damping: 28, mass: 0.4 });

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

  // rAF-based inertia loop with rubber-band edge resistance + spring-back
  const startInertia = useCallback(() => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);

    const FRICTION = 0.88;       // velocity decay per frame
    const OUT_FRICTION = 0.72;   // stronger friction when outside bounds (resist overshoot)
    const MIN_VEL = 0.5;         // stop threshold in px
    const SNAPBACK_VEL = 12;     // px/frame at which we switch to spring snap-back

    const loop = () => {
      const { minX, maxX, minY, maxY } = getBounds();
      const curX = x.get();
      const curY = y.get();

      const outOfBoundsX = curX < minX || curX > maxX;
      const outOfBoundsY = curY < minY || curY > maxY;

      // Apply stronger friction when outside bounds to kill overshoot quickly
      velX.current *= outOfBoundsX ? OUT_FRICTION : FRICTION;
      velY.current *= outOfBoundsY ? OUT_FRICTION : FRICTION;

      // Velocity negligible — stop loop and snap back to bounds if needed
      if (Math.abs(velX.current) < MIN_VEL && Math.abs(velY.current) < MIN_VEL) {
        velX.current = 0;
        velY.current = 0;
        rafId.current = null;

        // Spring-back: set the spring target to the clamped position.
        // Framer-motion spring will animate smoothly back into bounds.
        const snappedX = clamp(curX, minX, maxX);
        const snappedY = clamp(curY, minY, maxY);
        if (curX !== snappedX) x.set(snappedX);
        if (curY !== snappedY) y.set(snappedY);
        return;
      }

      // If we have high velocity but are out of bounds, snap back faster
      if (outOfBoundsX && Math.abs(velX.current) < SNAPBACK_VEL) {
        x.set(clamp(curX, minX, maxX));
      } else {
        // Apply rubber-band resistance: move toward new pos but with stretchy feel
        const nextX = curX + velX.current;
        x.set(applyRubberband(nextX, minX, maxX));
      }

      if (outOfBoundsY && Math.abs(velY.current) < SNAPBACK_VEL) {
        y.set(clamp(curY, minY, maxY));
      } else {
        const nextY = curY + velY.current;
        y.set(applyRubberband(nextY, minY, maxY));
      }

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

        const now = Date.now();
        const timeDelta = now - lastWheelTime.current;
        lastWheelTime.current = now;

        // Trackpad: fast events (< 50ms apart), boost scale
        // Mouse wheel: slow/chunky events, moderate scale
        const isMouseWheel = timeDelta > 50;
        const scale = isMouseWheel ? 0.8 : 2.5;

        // Accumulate into velocity
        velX.current -= dx * scale;
        velY.current -= dy * scale;

        // Cap max velocity
        const MAX_VEL = 200;
        velX.current = clamp(velX.current, -MAX_VEL, MAX_VEL);
        velY.current = clamp(velY.current, -MAX_VEL, MAX_VEL);

        // Kick off inertia loop
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

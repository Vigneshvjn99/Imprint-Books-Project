import React, { useRef, useEffect, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, useSpring, MotionValue } from 'framer-motion';
import { ZoomIn, ZoomOut } from 'lucide-react';

export const CanvasContext = React.createContext<{ x: MotionValue<number>, y: MotionValue<number> } | null>(null);

interface InfiniteCanvasProps {
  children: React.ReactNode;
}

// Rubber-band formula: allows slight overshoot past edges with resistance.
// The further past the bound, the more resistance is applied.
// coeff controls how elastic the stretch feels (0 = wall, 1 = no resistance)
const rubberband = (pos: number, bound: number, coeff: number): number => {
  if (coeff === 0) return pos;
  const overshoot = pos - bound;
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

  // Springs — tight and responsive for drag, scroll, and zoom
  const x = useSpring(0, { stiffness: 200, damping: 28, mass: 0.4 });
  const y = useSpring(0, { stiffness: 200, damping: 28, mass: 0.4 });
  const scale = useSpring(1, { stiffness: 200, damping: 28, mass: 0.4 });

  // Real-time scale percentage display
  const [scaleDisplay, setScaleDisplay] = React.useState(100);

  useEffect(() => {
    const unsubscribe = scale.on('change', (latest) => {
      setScaleDisplay(Math.round(latest * 100));
    });
    return unsubscribe;
  }, [scale]);

  // Inertia state
  const velX = useRef(0);
  const velY = useRef(0);
  const rafId = useRef<number | null>(null);
  const lastWheelTime = useRef(0);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  // Calculates the minimum scale required so the book grid canvas completely covers the viewport.
  // This locks zoom-out so the plain background is never revealed.
  const getMinScale = useCallback(() => {
    if (!containerRef.current || !gridRef.current) return 0.35;
    const viewportWidth = containerRef.current.clientWidth;
    const viewportHeight = containerRef.current.clientHeight;
    const gridWidth = gridRef.current.scrollWidth;
    const gridHeight = gridRef.current.scrollHeight;

    // Ratios of viewport to actual untransformed grid dimensions
    const scaleToFitWidth = viewportWidth / gridWidth;
    const scaleToFitHeight = viewportHeight / gridHeight;

    // Use the max of the two ratios to ensure the grid covers both dimensions fully.
    // Clamped to a minimum baseline of 0.35.
    return Math.max(0.35, Math.max(scaleToFitWidth, scaleToFitHeight));
  }, []);

  const getBounds = useCallback((scaleVal = scale.get()) => {
    if (!containerRef.current || !gridRef.current) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const viewportWidth = containerRef.current.clientWidth;
    const viewportHeight = containerRef.current.clientHeight;
    const gridWidth = gridRef.current.scrollWidth;
    const gridHeight = gridRef.current.scrollHeight;
    
    // Scale-adjusted bounds (assuming transform-origin is 0 0)
    const minX = Math.min(0, viewportWidth - gridWidth * scaleVal);
    const maxX = 0;
    const minY = Math.min(0, viewportHeight - gridHeight * scaleVal);
    const maxY = 0;
    return { minX, maxX, minY, maxY };
  }, [scale]);

  // Center canvas on first load
  useEffect(() => {
    if (!containerRef.current || !gridRef.current) return;
    
    const centerCanvas = () => {
      const viewportWidth = containerRef.current!.clientWidth;
      const viewportHeight = containerRef.current!.clientHeight;
      const gridWidth = gridRef.current!.scrollWidth;
      const gridHeight = gridRef.current!.scrollHeight;

      const currentScale = scale.get();
      const minX = Math.min(0, viewportWidth - gridWidth * currentScale);
      const minY = Math.min(0, viewportHeight - gridHeight * currentScale);

      const initialX = Math.max(minX, Math.min(0, (viewportWidth - gridWidth * currentScale) / 2));
      const initialY = Math.max(minY, Math.min(0, (viewportHeight - gridHeight * currentScale) / 2));

      x.jump(initialX);
      y.jump(initialY);
    };

    const timeoutId = setTimeout(centerCanvas, 50);
    return () => clearTimeout(timeoutId);
  }, [x, y, scale]);

  // Core Zoom Calculation: scales around a viewport focus coordinate (focusX, focusY)
  const zoomTo = useCallback((nextScale: number, focusX: number, focusY: number) => {
    const curScale = scale.get();
    const curX = x.get();
    const curY = y.get();

    // Scale range clamp: dynamically locked by minScale up to 2.0x
    const minScale = getMinScale();
    const clampedScale = Math.max(minScale, Math.min(2.0, nextScale));
    if (clampedScale === curScale) return;

    const scaleRatio = clampedScale / curScale;
    const newX = focusX - (focusX - curX) * scaleRatio;
    const newY = focusY - (focusY - curY) * scaleRatio;

    scale.set(clampedScale);

    const { minX, maxX, minY, maxY } = getBounds(clampedScale);
    x.set(clamp(newX, minX, maxX));
    y.set(clamp(newY, minY, maxY));
  }, [x, y, scale, getBounds, getMinScale]);

  // Handle window resizing dynamically to enforce minScale and layout bounds
  useEffect(() => {
    const handleResize = () => {
      const minScale = getMinScale();
      const curScale = scale.get();
      
      if (curScale < minScale) {
        if (!containerRef.current) return;
        const focusX = containerRef.current.clientWidth / 2;
        const focusY = containerRef.current.clientHeight / 2;
        zoomTo(minScale, focusX, focusY);
      } else {
        const { minX, maxX, minY, maxY } = getBounds(curScale);
        x.set(clamp(x.get(), minX, maxX));
        y.set(clamp(y.get(), minY, maxY));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getBounds, getMinScale, scale, x, y, zoomTo]);

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

      velX.current *= outOfBoundsX ? OUT_FRICTION : FRICTION;
      velY.current *= outOfBoundsY ? OUT_FRICTION : FRICTION;

      if (Math.abs(velX.current) < MIN_VEL && Math.abs(velY.current) < MIN_VEL) {
        velX.current = 0;
        velY.current = 0;
        rafId.current = null;

        const snappedX = clamp(curX, minX, maxX);
        const snappedY = clamp(curY, minY, maxY);
        if (curX !== snappedX) x.set(snappedX);
        if (curY !== snappedY) y.set(snappedY);
        return;
      }

      if (outOfBoundsX && Math.abs(velX.current) < SNAPBACK_VEL) {
        x.set(clamp(curX, minX, maxX));
      } else {
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

  // Handle gestures (drag, wheel, pinch-to-zoom)
  useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => {
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
        if (event.ctrlKey) {
          event.preventDefault();
          const rect = containerRef.current?.getBoundingClientRect();
          const focusX = event.clientX - (rect?.left || 0);
          const focusY = event.clientY - (rect?.top || 0);

          // dy is negative for pinch-out (zoom in), positive for pinch-in (zoom out)
          const factor = 1 - dy * 0.008;
          const nextScale = scale.get() * factor;
          zoomTo(nextScale, focusX, focusY);
          return;
        }

        event.preventDefault();

        const now = Date.now();
        const timeDelta = now - lastWheelTime.current;
        lastWheelTime.current = now;

        const isMouseWheel = timeDelta > 50;
        const scaleVal = isMouseWheel ? 0.8 : 2.5;

        velX.current -= dx * scaleVal;
        velY.current -= dy * scaleVal;

        const MAX_VEL = 200;
        velX.current = clamp(velX.current, -MAX_VEL, MAX_VEL);
        velY.current = clamp(velY.current, -MAX_VEL, MAX_VEL);

        startInertia();
      },
      onPinch: ({ origin: [ox, oy], first, movement: [s], memo }) => {
        if (first) {
          memo = scale.get();
        }
        const rect = containerRef.current?.getBoundingClientRect();
        const focusX = ox - (rect?.left || 0);
        const focusY = oy - (rect?.top || 0);
        const nextScale = memo * s;
        zoomTo(nextScale, focusX, focusY);
        return memo;
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
      },
      pinch: {
        eventOptions: { passive: false }
      }
    }
  );

  // Prevent default browser touch / pinch actions (safari zoom, pinch page)
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventDefault);
    document.addEventListener('gesturechange', preventDefault);
    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // UI Button Actions
  const zoomIn = () => {
    if (!containerRef.current) return;
    const focusX = containerRef.current.clientWidth / 2;
    const focusY = containerRef.current.clientHeight / 2;
    zoomTo(scale.get() + 0.15, focusX, focusY);
  };

  const zoomOut = () => {
    if (!containerRef.current) return;
    const focusX = containerRef.current.clientWidth / 2;
    const focusY = containerRef.current.clientHeight / 2;
    zoomTo(scale.get() - 0.15, focusX, focusY);
  };

  const resetZoom = () => {
    if (!containerRef.current || !gridRef.current) return;
    const viewportWidth = containerRef.current.clientWidth;
    const viewportHeight = containerRef.current.clientHeight;
    const gridWidth = gridRef.current.scrollWidth;
    const gridHeight = gridRef.current.scrollHeight;

    scale.set(1.0);

    const minX = Math.min(0, viewportWidth - gridWidth);
    const minY = Math.min(0, viewportHeight - gridHeight);
    const initialX = Math.max(minX, Math.min(0, (viewportWidth - gridWidth) / 2));
    const initialY = Math.max(minY, Math.min(0, (viewportHeight - gridHeight) / 2));

    x.set(initialX);
    y.set(initialY);
  };

  return (
    <CanvasContext.Provider value={{ x, y }}>
      <div
        ref={containerRef}
        className="fixed inset-0 cursor-grab active:cursor-grabbing touch-none overflow-hidden bg-[#fbfaf5] dark:bg-[#161616] transition-colors duration-700"
      >
        <motion.div
          ref={gridRef}
          className="absolute top-0 left-0 will-change-transform animate-none"
          style={{ 
            x, 
            y, 
            scale,
            transformOrigin: '0 0',
            transformStyle: 'preserve-3d'
          }}
        >
          {children}
        </motion.div>

        {/* Floating Zoom Controls */}
        <div className="absolute bottom-24 right-6 z-40 flex flex-col items-center gap-1.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-black/5 dark:border-white/10 shadow-lg pointer-events-auto select-none">
          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={zoomIn}
            className="p-2 rounded-xl text-black dark:text-white cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn className="w-[18px] h-[18px]" />
          </motion.button>
          
          <div className="h-[1px] w-6 bg-black/5 dark:bg-white/10" />
          
          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={resetZoom}
            className="py-1 px-1.5 rounded-lg text-black/70 dark:text-white/70 font-sans font-semibold text-[10px] text-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center min-w-[32px] select-none"
            title="Reset Zoom"
          >
            {scaleDisplay}%
          </motion.button>
          
          <div className="h-[1px] w-6 bg-black/5 dark:bg-white/10" />
          
          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={zoomOut}
            className="p-2 rounded-xl text-black dark:text-white cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut className="w-[18px] h-[18px]" />
          </motion.button>
        </div>
      </div>
    </CanvasContext.Provider>
  );
}

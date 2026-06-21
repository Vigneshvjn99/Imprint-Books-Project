import React, { useRef, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { motion, useSpring, MotionValue } from 'framer-motion';

export const CanvasContext = React.createContext<{ x: MotionValue<number>, y: MotionValue<number> } | null>(null);

interface InfiniteCanvasProps {
  children: React.ReactNode;
}

export function InfiniteCanvas({ children }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Use springs with a looser, 'floaty' configuration for that GSAP-like smooth tracking
  const x = useSpring(0, { stiffness: 80, damping: 20, mass: 0.5 });
  const y = useSpring(0, { stiffness: 80, damping: 20, mass: 0.5 });

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const getBounds = () => {
    if (!containerRef.current || !gridRef.current) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const viewportWidth = containerRef.current.clientWidth;
    const viewportHeight = containerRef.current.clientHeight;
    const gridWidth = gridRef.current.scrollWidth;
    const gridHeight = gridRef.current.scrollHeight;
    
    // We restrict drag so the grid always covers the viewport.
    const minX = Math.min(0, viewportWidth - gridWidth);
    const maxX = 0;
    const minY = Math.min(0, viewportHeight - gridHeight);
    const maxY = 0;
    
    return { minX, maxX, minY, maxY };
  };

  // Handle gestures (drag only, no zoom)
  useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => {
        // dx and dy are rubberbanded automatically by the config below when going beyond bounds
        x.set(dx);
        y.set(dy);
      },
      onDragEnd: ({ offset: [dx, dy], velocity: [vx, vy], direction: [dirX, dirY] }) => {
        const { minX, maxX, minY, maxY } = getBounds();
        
        // Smooth momentum glide
        const rawTargetX = dx + (vx * dirX * 200);
        const rawTargetY = dy + (vy * dirY * 200);
        
        x.set(clamp(rawTargetX, minX, maxX));
        y.set(clamp(rawTargetY, minY, maxY));
      },
      onWheel: ({ event, delta: [dx, dy] }) => {
        // Handle trackpad scrolling to pan
        event.preventDefault();
        const { minX, maxX, minY, maxY } = getBounds();
        x.set(clamp(x.get() - dx, minX, maxX));
        y.set(clamp(y.get() - dy, minY, maxY));
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

  // Prevent default touch behaviors (like pull-to-refresh)
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventDefault);
    document.addEventListener('gesturechange', preventDefault);
    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
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
          style={{ 
            x, 
            y
          }}
        >
          {children}
        </motion.div>
      </div>
    </CanvasContext.Provider>
  );
}

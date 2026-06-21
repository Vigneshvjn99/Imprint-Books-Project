import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useAnimationControls,
} from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DraggableCardBody = ({
  className,
  children,
  style,
  draggable = true,
  animate: customAnimate,
  onClick,
}: {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  draggable?: boolean;
  animate?: any;
  onClick?: () => void;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [constraints, setConstraints] = useState({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });

  const springConfig = {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  };

  useEffect(() => {
    // Update constraints when component mounts or window resizes
    const updateConstraints = () => {
      if (typeof window !== "undefined") {
        setConstraints({
          top: -window.innerHeight / 2,
          left: -window.innerWidth / 2,
          right: window.innerWidth / 2,
          bottom: window.innerHeight / 2,
        });
      }
    };

    updateConstraints();

    // Add resize listener
    window.addEventListener("resize", updateConstraints);

    // Clean up
    return () => {
      window.removeEventListener("resize", updateConstraints);
    };
  }, []);

  return (
    <motion.div
      ref={cardRef}
      drag={draggable}
      dragConstraints={draggable ? constraints : undefined}
      onDragStart={draggable ? () => {
        document.body.style.cursor = "grabbing";
      } : undefined}
      onDragEnd={draggable ? () => {
        document.body.style.cursor = "default";

        controls.start({
          rotateX: 0,
          rotateY: 0,
          transition: {
            type: "spring",
            ...springConfig,
          },
        });
      } : undefined}
      style={{
        willChange: "transform",
        ...style,
      }}
      animate={customAnimate || controls}
      onClick={onClick}
      className={cn(
        "relative w-[var(--card-max-width)] h-auto overflow-hidden rounded-[12px] p-5 md:p-7 shadow-2xl transform-3d select-none",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const DraggableCardContainer = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className={cn("[perspective:3000px]", className)}>{children}</div>
  );
};

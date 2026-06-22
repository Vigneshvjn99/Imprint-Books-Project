import { useState, useContext } from 'react';
import { motion, AnimatePresence, useVelocity, useTransform, useSpring } from 'framer-motion';
import { CanvasContext } from './InfiniteCanvas';

export interface Book {
  id: number;
  title: string;
  author: string;
  image: string;
  spine: string;
  backCover?: string;
  category: string;
  width?: number;
  height?: number;
}

interface BookCardProps {
  book: Book;
  onSelect?: (book: Book) => void;
  isMatched?: boolean;
  isFirstRow?: boolean;
  isFirstCol?: boolean;
}

export function BookCard({ book, onSelect, isMatched = true, isFirstRow, isFirstCol }: BookCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const canvasContext = useContext(CanvasContext);
  
  // Use default spring if context is missing (though it shouldn't be)
  const defaultSpring = useSpring(0);
  const xVel = useVelocity(canvasContext?.x || defaultSpring);
  const yVel = useVelocity(canvasContext?.y || defaultSpring);

  // Transform velocity into rotation degrees for the "Wind Effect"
  // When dragging left (negative x velocity), books lean left (positive rotateY)
  const skewY = useTransform(xVel, [-3000, 3000], [-35, 35], { clamp: true });
  // When dragging up (negative y velocity), books lean up (positive rotateX)
  const skewX = useTransform(yVel, [-3000, 3000], [35, -35], { clamp: true });

  return (
    <div 
      // 500x500 cell, 1px perfect border logic, 20px inner padding
      className={`bg-[#fbfaf5] dark:bg-[#161616] border-b border-r ${isFirstRow ? 'border-t' : ''} ${isFirstCol ? 'border-l' : ''} border-black/[0.04] dark:border-white/[0.04] overflow-clip relative shrink-0 w-[500px] h-[500px] transition-colors duration-700`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`w-full h-full p-5 transition-all duration-700 ${isMatched ? 'opacity-100' : 'opacity-10 grayscale pointer-events-none'}`}>
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ 
            perspective: '1200px',
            width: book.width || 222,
            height: book.height || 334
          }}
        >
        <motion.div
          className="relative w-full h-full cursor-pointer"
          style={{ transformStyle: 'preserve-3d', rotateY: skewY, rotateX: skewX }}
          initial="rest"
          animate={isHovered ? "hover" : "rest"}
          onClick={() => onSelect?.(book)}
        >
          {/* --- BACK COVER & PAGES (Static inside) --- */}
          <div 
            className="absolute inset-0 bg-stone-200 dark:bg-stone-800 rounded-[3px] shadow-[0px_4px_18px_rgba(0,0,0,0.06)]" 
            style={{ transform: 'translateZ(-15px) translateX(2px)' }}
          >
            {/* Simulated page edges */}
            <div className="absolute inset-y-1 right-0 w-[2px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
            <div className="absolute inset-y-2 right-1 w-[2px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
            <div className="absolute inset-y-3 right-2 w-[2px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
          </div>

          {/* --- BOOK SPINE --- */}
          <div 
            className="absolute left-[9px] top-0 bottom-0 w-[10px] origin-right rounded-l-sm overflow-hidden z-0" 
            style={{ 
              transform: 'translateX(-100%) rotateY(90deg)',
              transformOrigin: 'right center'
            }}
          >
            <img src={book.spine} alt="spine" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          </div>

          {/* --- FRONT COVER (Animates to open) --- */}
          <motion.div
            layoutId={`book-cover-${book.id}`}
            className="absolute inset-0 rounded-[3px] overflow-hidden"
            style={{ 
              originX: 0, 
              transformStyle: 'preserve-3d',
              // Removed the grey border stroke
            }}
            variants={{
              rest: { 
                rotateY: 0, 
                boxShadow: '0px 3px 12px rgba(0,0,0,0.10)' 
              },
              hover: { 
                rotateY: -25,
                boxShadow: '0px 6px 18px rgba(0,0,0,0.15)' 
              }
            }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
          >
            {/* Actual Book Image */}
            <img src={book.image} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
            
            {/* Front cover gradient overlay for physical lighting */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/10 pointer-events-none" />
            
            {/* Spine crease shadow on the cover */}
            <div className="absolute left-0 inset-y-0 w-[4px] bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
          </motion.div>
        </motion.div>
      </div>

      {/* Hover Text Reveal (Positioned at bottom within the 20px padding) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-5 left-5 right-5 pointer-events-none flex justify-between items-end gap-4 overflow-hidden"
          >
            <p className="font-semibold text-[16px] text-black dark:text-white tracking-[-0.16px] transition-colors duration-700 truncate flex-1">
              {book.title}
            </p>
            <p className="font-normal text-[14px] text-black dark:text-white/70 tracking-[-0.14px] transition-colors duration-700 whitespace-nowrap shrink-0">
              {book.author}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

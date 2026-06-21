import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Book } from './BookCard';
import { BackgroundRippleEffect } from './ui/background-ripple-effect';
import { DraggableCardBody, DraggableCardContainer } from './ui/draggable-card';
import TextType from './ui/TextType';

interface BookModalProps {
  book: Book;
  onClose: () => void;
}

interface BookDetails {
  aboutBook: string;
  aboutAuthor: string;
  whoShouldGetThis: string;
  amazonUrl?: string;
}

export function BookModal({ book, onClose }: BookModalProps) {
  const [details, setDetails] = useState<BookDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Card deck cycle state
  const [cardOrder, setCardOrder] = useState<('book' | 'author' | 'who')[]>(['book', 'author', 'who']);
  const [swappingCard, setSwappingCard] = useState<'book' | 'author' | 'who' | null>(null);

  const isLongTitle = book.title.length > 30;
  const titleClass = isLongTitle
    ? "text-[22px] md:text-[30px] lg:text-[38px] xl:text-[42px] 2xl:text-[48px] leading-[1.15]"
    : "text-[28px] md:text-[38px] lg:text-[48px] xl:text-[52px] 2xl:text-[62px] leading-[1.1]";

  // Typewriter completion tracking
  const [isTitleFinished, setIsTitleFinished] = useState(false);

  useEffect(() => {
    setIsTitleFinished(false);
  }, [book.title]);

  // Prevent scrolling on the body while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Fetch structured book descriptions from JSON database
  useEffect(() => {
    async function fetchBookData() {
      setIsLoading(true);
      try {
        const res = await fetch('/books/descriptions.json');
        const data = await res.json();
        
        if (data[book.title]) {
          setDetails({
            aboutBook: data[book.title].aboutBook || 'No detailed summary available.',
            aboutAuthor: data[book.title].aboutAuthor || 'No author details available.',
            whoShouldGetThis: data[book.title].whoShouldGetThis || 'Perfect for design enthusiasts.',
            amazonUrl: data[book.title].amazonUrl
          });
        } else {
          setDetails({
            aboutBook: 'No detailed synopsis is available for this edition.',
            aboutAuthor: 'No author details available.',
            whoShouldGetThis: 'Perfect for design enthusiasts.'
          });
        }
      } catch (err) {
        setDetails({
          aboutBook: 'No detailed synopsis is available for this edition.',
          aboutAuthor: 'No author details available.',
          whoShouldGetThis: 'Perfect for design enthusiasts.'
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchBookData();
  }, [book]);

  const fallbackAmazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(`${book.title} ${book.author} book`)}`;
  const amazonUrl = details?.amazonUrl || fallbackAmazonUrl;

  const playCardSwapSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Create a white noise buffer (shorter duration for a faster sweep)
      const duration = 0.12; // seconds
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      // Set up a bandpass filter with higher Q (6.0) for a sharper, focused swoosh
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(6.0, ctx.currentTime);
      
      // Sweep the filter frequency down from 2000Hz to 600Hz for a crisp paper friction whoosh
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + duration);
      
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.09, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      // Connect nodes
      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      noiseNode.start();
      noiseNode.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Card audio playback failed", e);
    }
  };

  const playSketchSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const duration = 0.6; // Matches the border draw duration
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        const time = i / ctx.sampleRate;
        // Minor 120Hz grain modulation to represent paper texture/tooth
        const grainMod = 0.85 + 0.15 * Math.sin(2 * Math.PI * 120 * time);
        data[i] = (Math.random() * 2 - 1) * grainMod;
      }
      
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(4.5, ctx.currentTime);
      
      // Sweep filter from 3200Hz down to 2200Hz to represent the pencil line drawing friction
      filter.frequency.setValueAtTime(3200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + duration);
      
      const gainNode = ctx.createGain();
      // Soft touchdown (attack) and liftoff (decay)
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      noiseSource.start();
      noiseSource.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Sketch sound playback failed", e);
    }
  };

  const cycleCard = (cardKey: 'book' | 'author' | 'who') => {
    // Only cycle when the top card is clicked
    if (cardOrder[0] !== cardKey || swappingCard !== null) return;
    
    playCardSwapSound();
    setSwappingCard(cardKey);
    setTimeout(() => {
      setCardOrder(prev => {
        const next = [...prev];
        const top = next.shift()!;
        next.push(top);
        return next;
      });
      setSwappingCard(null);
    }, 280);
  };

  const getCardStyles = (cardKey: 'book' | 'author' | 'who') => {
    const position = cardOrder.indexOf(cardKey);
    const isSwapping = swappingCard === cardKey;

    if (isSwapping) {
      return {
        y: -140,
        rotate: -15,
        scale: 0.9,
        zIndex: 5,
        opacity: 1,
        transition: { type: "tween", duration: 0.32, ease: [0.32, 0.94, 0.6, 1] }
      };
    }

    const baseRotations = {
      book: -1.49,
      author: 5.57,
      who: 9.43
    };

    const gentleTransition = { type: "tween", duration: 0.35, ease: [0.32, 0.94, 0.6, 1] };

    if (position === 0) {
      return {
        y: 24,
        scale: 1,
        rotate: baseRotations[cardKey],
        zIndex: 30,
        opacity: 1,
        transition: gentleTransition
      };
    } else if (position === 1) {
      return {
        y: 12,
        scale: 0.96,
        rotate: baseRotations[cardKey],
        zIndex: 20,
        opacity: 1,
        transition: gentleTransition
      };
    } else {
      return {
        y: 0,
        scale: 0.92,
        rotate: baseRotations[cardKey],
        zIndex: 10,
        opacity: 1,
        transition: gentleTransition
      };
    }
  };



  const cardConfig = {
    book: {
      title: "ABOUT THE BOOK",
      bg: "bg-white dark:bg-[#1c1c1e] text-[#1a1a1a] dark:text-[#f4f4f5]",
      headerColor: "text-[#697082] dark:text-[#a1a1aa]",
      iconSrc: "/books/icon_book.svg",
      iconClass: "dark:invert",
      textColor: "text-[#1a1a1a] dark:text-[#e4e4e7]",
      content: details?.aboutBook || 'Loading...'
    },
    author: {
      title: "ABOUT THE AUTHOR",
      bg: "bg-[#373737] dark:bg-[#333333] text-white",
      headerColor: "text-white/60",
      iconSrc: "/books/icon_author.svg",
      iconClass: "brightness-0 invert",
      textColor: "text-white",
      content: details?.aboutAuthor || 'Loading...'
    },
    who: {
      title: "WHO SHOULD GET THIS",
      bg: "bg-[#dadada] dark:bg-[#252527] text-black dark:text-[#f4f4f5]",
      headerColor: "text-[#697082] dark:text-[#a1a1aa]",
      iconSrc: "/books/icon_who.svg",
      iconClass: "dark:invert",
      textColor: "text-black dark:text-[#e4e8e7]",
      content: details?.whoShouldGetThis || 'Loading...'
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-[#fbfaf5] dark:bg-[#161616] overflow-hidden flex flex-col md:flex-row font-sans"
    >
      {/* Responsive layout constants injected */}
      <style>{`
        :root {
          --book-height: 245px;
          --card-max-width: 320px;
          --card-height: 260px;
        }
        @media (min-width: 768px) {
          :root {
            --book-height: 370px;
            --card-max-width: 400px;
            --card-height: 290px;
          }
        }
        @media (min-width: 1024px) {
          :root {
            --book-height: 485px;
            --card-max-width: 450px;
            --card-height: 320px;
          }
        }
        @media (min-width: 1280px) {
          :root {
            --book-height: 580px;
            --card-max-width: 480px;
            --card-height: 340px;
          }
        }
        @media (min-width: 1536px) {
          :root {
            --book-height: 650px;
            --card-max-width: 480px;
            --card-height: 340px;
          }
        }
      `}</style>

      <BackgroundRippleEffect />

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all text-black dark:text-white cursor-pointer pointer-events-auto"
      >
        <X size={24} />
      </button>

      {/* LEFT SECTION: Title, Author & Bottom-aligned 3D Mockup */}
      <div className="w-full md:w-[49%] h-1/2 md:h-full relative bg-transparent flex flex-col justify-between p-8 md:p-12 lg:p-16 xl:p-20 pointer-events-none z-20">
        {/* Title and Author Group */}
        <div className="max-w-[500px]">
          <TextType
            as="h2"
            text={book.title}
            loop={false}
            typingSpeed={18}
            initialDelay={200}
            showCursor={true}
            cursorCharacter="|"
            preserveLayout={true}
            className={`${titleClass} font-medium tracking-tight text-black dark:text-white font-sans break-words`}
            onSentenceComplete={() => setIsTitleFinished(true)}
          />
          <motion.p 
            initial={{ opacity: 0, y: 4 }}
            animate={{ 
              opacity: isTitleFinished ? 0.6 : 0, 
              y: isTitleFinished ? 0 : 4 
            }}
            transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
            className="text-[15px] md:text-[17px] lg:text-[19px] xl:text-[20px] 2xl:text-[22px] font-medium text-black/60 dark:text-white/60 mt-3 font-sans tracking-wide"
          >
            {book.author}
          </motion.p>
        </div>

        {/* Bottom-aligned area for the book mockup — no overflow-hidden so book peeks below naturally */}
        <div className="flex-1 flex items-end justify-center min-h-0 pt-8 pb-0">
          {/* 3D Mockup Container — offset 15% of the book height below the container bottom so it peeks out */}
          <motion.div 
            variants={{
              initial: { y: 180, opacity: 0 },
              animate: { 
                y: 0, 
                opacity: 1,
                transition: { type: "spring", stiffness: 100, damping: 18, delay: 0.1 }
              },
              exit: { 
                y: 180, 
                opacity: 0,
                transition: { type: "tween", duration: 0.25, ease: "easeIn" }
              }
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-20 w-[calc(var(--book-height)*var(--book-aspect))] h-[var(--book-height)] shrink-0"
            style={{ 
              perspective: '1200px',
              '--book-aspect': (book.width && book.height) ? (book.width / book.height) : (222 / 334),
              marginBottom: 'calc(-0.15 * var(--book-height))'
            } as React.CSSProperties}
          >
            <div className="relative w-full h-full">
              {/* BACK COVER & PAGES */}
              <div 
                className="absolute inset-0 bg-stone-200 dark:bg-stone-800 rounded-[6px] shadow-[0px_10px_45px_rgba(0,0,0,0.15)]" 
                style={{ transform: 'translateZ(-15px) translateX(2px)' }}
              >
                <div className="absolute inset-y-1 right-0 w-[3px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
                <div className="absolute inset-y-2 right-1 w-[3px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
                <div className="absolute inset-y-3 right-2 w-[3px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
              </div>

              {/* BOOK SPINE */}
              <div 
                className="absolute left-[9px] top-0 bottom-0 w-[12px] origin-right rounded-l-sm overflow-hidden z-0" 
                style={{ 
                  transform: 'translateX(-100%) rotateY(90deg)',
                  transformOrigin: 'right center'
                }}
              >
                <img src={book.spine} alt="spine" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
              </div>

              {/* FRONT COVER (No layoutId for home-to-detail transition continuity) */}
              <div
                className="absolute inset-0 rounded-[6px] overflow-hidden"
                style={{ 
                  boxShadow: '10px 15px 35px rgba(0,0,0,0.22)' 
                }}
              >
                <img src={book.image} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/15 pointer-events-none" />
                <div className="absolute left-0 inset-y-0 w-[5px] bg-gradient-to-r from-black/35 to-transparent pointer-events-none" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SECTION: Interactive stacked cards & Grab button */}
      <div className="w-full md:w-[51%] h-1/2 md:h-full relative bg-transparent flex flex-col items-center justify-center p-8 md:p-16 lg:p-24 overflow-hidden pointer-events-none z-20">

        {/* 3D Stacked Cards Container */}
        {/* Draggable Cards Container */}
        {/* Draggable Cards Container */}
        <DraggableCardContainer className="relative w-full max-w-[var(--card-max-width)] h-[calc(var(--card-height)+96px)] flex items-center justify-center mt-12 md:mt-0 pointer-events-auto">
          {['who', 'author', 'book'].map((cardKey) => {
            const config = cardConfig[cardKey as 'book' | 'author' | 'who'];
            const isTopCard = cardOrder[0] === cardKey;

            return (
              <DraggableCardBody
                key={cardKey}
                draggable={false}
                animate={getCardStyles(cardKey as 'book' | 'author' | 'who')}
                onClick={() => cycleCard(cardKey as 'book' | 'author' | 'who')}
                className={`absolute flex flex-col justify-start gap-[10px] md:gap-[14px] ${config.bg} ${
                  isTopCard ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
                }`}
                style={{ 
                  boxShadow: '0px 0px 4px 1px rgba(0,0,0,0.05)',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  transformOrigin: "bottom center"
                } as React.CSSProperties}
              >
                {/* Header */}
                <span className={`text-[11px] md:text-[13px] lg:text-[14px] font-semibold tracking-[1.8px] font-sans leading-[24px] md:leading-[32px] ${config.headerColor}`}>
                  {config.title}
                </span>

                {/* Icon */}
                <img 
                  src={config.iconSrc} 
                  alt="" 
                  className={`size-[36px] md:size-[42px] lg:size-[46px] shrink-0 object-contain aspect-square mt-3 md:mt-4 ${config.iconClass}`}
                />

                {/* Description text */}
                <div className="flex-1 overflow-y-auto no-scrollbar w-full text-left flex flex-col justify-between gap-4">
                  {isLoading ? (
                    <div className="space-y-3 w-full">
                      <div className="h-4 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded" />
                      <div className="h-4 w-[90%] bg-black/5 dark:bg-white/5 animate-pulse rounded" />
                    </div>
                  ) : (
                    <>
                      <p 
                        className={`text-[14px] md:text-[16px] lg:text-[18px] xl:text-[20px] font-normal leading-[1.4] tracking-[-0.28px] font-['Fraunces'] text-left ${config.textColor}`} 
                        style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1' }}
                      >
                        {config.content}
                      </p>
                      
                      {/* Rich Content Metadata Pills */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {cardKey === 'book' && (
                          <>
                            <span className="text-[10px] md:text-[11px] font-sans font-medium px-2.5 py-1 bg-black/5 dark:bg-white/10 rounded-full uppercase tracking-wider text-black/60 dark:text-white/80">Seminal Work</span>
                            <span className="text-[10px] md:text-[11px] font-sans font-medium px-2.5 py-1 bg-black/5 dark:bg-white/10 rounded-full uppercase tracking-wider text-black/60 dark:text-white/80">Core Theory</span>
                          </>
                        )}
                        {cardKey === 'author' && (
                          <>
                            <span className="text-[10px] md:text-[11px] font-sans font-medium px-2.5 py-1 bg-white/10 rounded-full uppercase tracking-wider text-white/70">Expert Insight</span>
                            <span className="text-[10px] md:text-[11px] font-sans font-medium px-2.5 py-1 bg-white/10 rounded-full uppercase tracking-wider text-white/70">Design Legacy</span>
                          </>
                        )}
                        {cardKey === 'who' && (
                          <>
                            <span className="text-[10px] md:text-[11px] font-sans font-medium px-2.5 py-1 bg-black/5 dark:bg-white/10 rounded-full uppercase tracking-wider text-black/60 dark:text-white/80">Essential Reference</span>
                            <span className="text-[10px] md:text-[11px] font-sans font-medium px-2.5 py-1 bg-black/5 dark:bg-white/10 rounded-full uppercase tracking-wider text-black/60 dark:text-white/80">Recommended</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </DraggableCardBody>
            );
          })}
        </DraggableCardContainer>

        {/* Grab This Book Button — positioned near the bottom */}
        <div className="absolute bottom-10 md:bottom-14 left-0 right-0 flex justify-center z-30 pointer-events-auto">
          <motion.a 
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onHoverStart={() => playSketchSound()}
            className="relative flex items-center gap-[10px] text-black dark:text-white font-sans font-normal text-[15px] md:text-[17px] lg:text-[19px] tracking-[-0.3px] cursor-pointer px-6 py-2.5 rounded-full overflow-visible"
            id={`grab-book-link-${book.id}`}
          >
            {/* SVG border drawing path animation */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <motion.rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="9999"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                variants={{
                  rest: { pathLength: 0, opacity: 0 },
                  hover: { 
                    pathLength: 1, 
                    opacity: 1, 
                    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } 
                  }
                }}
              />
            </svg>

            <motion.span
              variants={{
                rest: { opacity: 0.85 },
                hover: { opacity: 1, transition: { duration: 0.2 } }
              }}
            >
              Grab this book
            </motion.span>
            <motion.img 
              src="/books/icon_click.svg" 
              alt="" 
              variants={{
                rest: { x: 0, scale: 0.95 },
                hover: { x: 5, scale: 1.05, transition: { type: "spring", stiffness: 300, damping: 15 } },
                tap: { x: 2, scale: 0.95 }
              }}
              className="size-[18px] md:size-[21px] lg:size-[24px] shrink-0 object-contain dark:invert"
            />
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
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

  // Book cover flip state
  const [isFlipped, setIsFlipped] = useState(false);
  const [dominantColor, setDominantColor] = useState<string>('#2a2a2a');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const hasFlippedOnce = useRef(false);

  // Card deck cycle state
  const [cardOrder, setCardOrder] = useState<('book' | 'author' | 'who')[]>(['book', 'author', 'who']);
  const [swappingCard, setSwappingCard] = useState<'book' | 'author' | 'who' | null>(null);

  // Prevent typographic orphans (single word wrapping to the second line)
  const formattedTitle = (() => {
    const words = book.title.trim().split(/\s+/);
    if (words.length > 1) {
      const lastWord = words.pop();
      const secondToLast = words.pop();
      return [...words, `${secondToLast}\u00a0${lastWord}`].join(' ');
    }
    return book.title;
  })();

  const isLongTitle = formattedTitle.length > 30;

  // Typewriter completion tracking
  const [isTitleFinished, setIsTitleFinished] = useState(false);
  const [isTwoLines, setIsTwoLines] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsTitleFinished(false);
  }, [formattedTitle]);

  useEffect(() => {
    if (!titleRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        const fontSize = parseFloat(window.getComputedStyle(entry.target).fontSize);
        // Math check: 1 line is ~1.15x fontSize, 2 lines is ~2.3x. 
        // 1.45x is a very safe threshold to prevent false positives.
        setIsTwoLines(height > fontSize * 1.45);
      }
    });

    observer.observe(titleRef.current);
    return () => observer.disconnect();
  }, [formattedTitle]);

  // Extract dominant colour from book cover using bucket quantisation across the full image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = book.image;
    img.onload = () => {
      try {
        const SIZE = 80; // sample at 80×80 for good coverage without perf cost
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Draw the full image scaled down into the canvas
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

        // Bucket quantisation: round each channel to nearest step
        // Step = 12 gives ~21 buckets per channel — fine enough to distinguish main colours
        const STEP = 12;
        const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {};

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue; // skip transparent pixels
          const r = Math.round(data[i]     / STEP) * STEP;
          const g = Math.round(data[i + 1] / STEP) * STEP;
          const b = Math.round(data[i + 2] / STEP) * STEP;
          const key = `${r},${g},${b}`;
          if (!buckets[key]) buckets[key] = { count: 0, r, g, b };
          buckets[key].count++;
        }

        // Find the most frequent bucket
        let best = { count: 0, r: 42, g: 42, b: 42 };
        for (const bucket of Object.values(buckets)) {
          if (bucket.count > best.count) best = bucket;
        }

        // Convert to hex — no darkening, use the raw dominant colour
        const toHex = (v: number) => v.toString(16).padStart(2, '0');
        const hex = `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
        setDominantColor(hex);

        // Pick white or dark text based on W3C perceived brightness
        const brightness = (best.r * 299 + best.g * 587 + best.b * 114) / 1000;
        setTextColor(brightness > 145 ? '#1a1a1a' : '#ffffff');
      } catch (_) {
        // Cross-origin or canvas tainted — keep defaults
      }
    };
  }, [book.image]);

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

  const playFlipSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const duration = 0.18;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(4.0, ctx.currentTime);
      filter.frequency.setValueAtTime(1600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      source.start(); source.stop(ctx.currentTime + duration);
    } catch (_) {}
  };

  const handleCoverFlip = () => {
    playFlipSound();
    hasFlippedOnce.current = true;
    setIsFlipped(f => !f);
  };

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
          --book-height: ${isTwoLines ? '265px' : '290px'};
          --card-max-width: 320px;
          --card-height: 260px;
          --card-icon-size: 36px;
          --modal-padding-y: 2rem;
          --title-font-size: ${isLongTitle ? '22px' : '28px'};
          --title-leading: ${isLongTitle ? '1.15' : '1.1'};
          --mockup-padding-top: 1rem;
        }
        @media (min-width: 768px) {
          :root {
            --book-height: ${isTwoLines ? '390px' : '430px'};
            --card-max-width: 400px;
            --card-height: 290px;
            --card-icon-size: 42px;
            --modal-padding-y: 3rem;
            --title-font-size: ${isLongTitle ? '30px' : '38px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 1.5rem;
          }
        }
        @media (min-width: 1024px) {
          :root {
            --book-height: ${isTwoLines ? '520px' : '560px'};
            --card-max-width: 450px;
            --card-height: 320px;
            --card-icon-size: 46px;
            --modal-padding-y: 4rem;
            --title-font-size: ${isLongTitle ? '38px' : '48px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 2rem;
          }
        }
        @media (min-width: 1280px) {
          :root {
            --book-height: ${isTwoLines ? '620px' : '660px'};
            --card-max-width: 480px;
            --card-height: 340px;
            --card-icon-size: 46px;
            --modal-padding-y: 5rem;
            --title-font-size: ${isLongTitle ? '42px' : '52px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 2rem;
          }
        }
        @media (min-width: 1536px) {
          :root {
            --book-height: ${isTwoLines ? '680px' : '740px'};
            --card-max-width: 480px;
            --card-height: 340px;
            --card-icon-size: 46px;
            --modal-padding-y: 5rem;
            --title-font-size: ${isLongTitle ? '48px' : '62px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 2rem;
          }
        }
        @media (min-width: 1900px) {
          :root {
            --book-height: ${isTwoLines ? '33vw' : '37.5vw'};
            --card-max-width: 440px;
            --card-height: 310px;
            --card-icon-size: 42px;
            --modal-padding-y: 4rem;
            --title-font-size: ${isLongTitle ? '38px' : '48px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 1.5rem;
          }
        }
        
        /* Height-based overrides for desktop/tablet to handle short screens (like Windows laptops) */
        @media (min-width: 768px) and (max-height: 950px) {
          :root {
            --book-height: ${isTwoLines ? '540px' : '580px'};
            --card-height: 340px;
            --card-icon-size: 42px;
            --modal-padding-y: 3.5rem;
            --title-font-size: ${isLongTitle ? '36px' : '44px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 1.5rem;
          }
        }
        @media (min-width: 768px) and (max-height: 820px) {
          :root {
            --book-height: ${isTwoLines ? '460px' : '500px'};
            --card-height: 300px;
            --card-icon-size: 38px;
            --modal-padding-y: 2.5rem;
            --title-font-size: ${isLongTitle ? '30px' : '38px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 1.25rem;
          }
        }
        @media (min-width: 768px) and (max-height: 720px) {
          :root {
            --book-height: ${isTwoLines ? '380px' : '410px'};
            --card-height: 260px;
            --card-icon-size: 34px;
            --modal-padding-y: 2rem;
            --title-font-size: ${isLongTitle ? '26px' : '32px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 1rem;
          }
        }
        @media (min-width: 768px) and (max-height: 620px) {
          :root {
            --book-height: ${isTwoLines ? '280px' : '300px'};
            --card-height: 220px;
            --card-icon-size: 30px;
            --modal-padding-y: 1.5rem;
            --title-font-size: ${isLongTitle ? '20px' : '26px'};
            --title-leading: ${isLongTitle ? '1.15' : '1.1'};
            --mockup-padding-top: 0.75rem;
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
      <div className="w-full md:w-[49%] h-1/2 md:h-full relative bg-transparent flex flex-col justify-between px-8 md:px-12 lg:px-16 xl:px-20 py-[var(--modal-padding-y)] pointer-events-auto z-20">
        {/* Title and Author Group — non-interactive */}
        <div className="max-w-[600px] pointer-events-none">
          <div ref={titleRef}>
            <TextType
              as="h2"
              text={formattedTitle}
              loop={false}
              typingSpeed={55}
              initialDelay={200}
              showCursor={!isTitleFinished}
              cursorCharacter="|"
              preserveLayout={true}
              className="font-semibold tracking-tight text-black dark:text-white font-sans break-words"
              style={{ fontSize: 'var(--title-font-size)', lineHeight: 'var(--title-leading)' }}
              onSentenceComplete={() => setIsTitleFinished(true)}
            />
          </div>
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

        {/* Bottom-aligned area for the book mockup */}
        <div className="flex-1 flex items-end justify-center min-h-0 pb-0" style={{ paddingTop: 'var(--mockup-padding-top)' }}>

          {/* 3D Mockup Container */}
          <motion.div
            variants={{
              initial: { y: 180, opacity: 0 },
              animate: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 18, delay: 0.1 } },
              exit:    { y: 180, opacity: 0, transition: { type: 'tween', duration: 0.25, ease: 'easeIn' } }
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-20 w-[calc(var(--book-height)*var(--book-aspect))] h-[var(--book-height)] shrink-0 cursor-pointer pointer-events-auto"
            style={{
              perspective: '1400px',
              '--book-aspect': (book.width && book.height) ? (book.width / book.height) : (222 / 334),
              marginBottom: isTwoLines ? '20px' : '30px'
            } as React.CSSProperties}
            onClick={handleCoverFlip}
            title={isFlipped ? 'Click to flip back' : 'Click to flip'}
          >
            {/* Flip wrapper — pure CSS transition, NOT Framer Motion animate.
                Framer Motion serialises rotateY as matrix3d which silently
                flattens preserve-3d and breaks backfaceVisibility. */}
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1)',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >

              {/* ── FRONT FACE ── */}
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                {/* Page stack */}
                <div
                  className="absolute inset-0 bg-stone-200 dark:bg-stone-800 rounded-[6px] shadow-[0px_10px_45px_rgba(0,0,0,0.15)]"
                  style={{ transform: 'translateZ(-15px) translateX(2px)' }}
                >
                  <div className="absolute inset-y-1 right-0 w-[3px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
                  <div className="absolute inset-y-2 right-1 w-[3px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
                  <div className="absolute inset-y-3 right-2 w-[3px] bg-stone-300 dark:bg-stone-700 rounded-r-sm" />
                </div>

                {/* Spine */}
                <div
                  className="absolute left-[9px] top-0 bottom-0 w-[12px] rounded-l-sm overflow-hidden z-0"
                  style={{ transform: 'translateX(-100%) rotateY(90deg)', transformOrigin: 'right center' }}
                >
                  <img src={book.spine} alt="spine" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                </div>

                {/* Front cover */}
                <div className="absolute inset-0 rounded-[6px] overflow-hidden" style={{ boxShadow: '10px 15px 35px rgba(0,0,0,0.22)' }}>
                  <img src={book.image} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/15 pointer-events-none" />
                  <div className="absolute left-0 inset-y-0 w-[5px] bg-gradient-to-r from-black/35 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* ── BACK FACE ── book texture image if available, solid colour fallback */}
              <div
                className="absolute inset-0 rounded-[6px] overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  backgroundColor: dominantColor,
                  boxShadow: '-10px 15px 35px rgba(0,0,0,0.28)'
                }}
              >
                {/* Full-bleed background texture from AI-generated back cover */}
                {book.backCover && (
                  <img
                    src={book.backCover}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}


                {/* Author content */}
                <div className="relative z-10 flex flex-col justify-between h-full p-[8%]" style={{ color: textColor }}>
                  {/* Header */}
                  <div>
                    <p className="text-[9px] md:text-[10px] font-semibold tracking-[2px] font-sans uppercase opacity-60 mb-2">About the Author</p>
                    <p className="text-[13px] md:text-[15px] lg:text-[17px] font-semibold font-sans leading-tight mb-3 opacity-90">{book.author}</p>
                    <div className="w-8 h-[1.5px] rounded-full mb-3" style={{ backgroundColor: textColor, opacity: 0.3 }} />
                  </div>

                  {/* Author description */}
                  <div className="flex-1 overflow-hidden">
                    {isLoading ? (
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded" style={{ backgroundColor: textColor, opacity: 0.1 }} />
                        <div className="h-3 w-[85%] rounded" style={{ backgroundColor: textColor, opacity: 0.1 }} />
                        <div className="h-3 w-[70%] rounded" style={{ backgroundColor: textColor, opacity: 0.1 }} />
                      </div>
                    ) : (
                      <p
                        className="text-[11px] md:text-[12px] lg:text-[14px] leading-[1.55] font-['Fraunces'] opacity-85"
                        style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1' }}
                      >
                        {details?.aboutAuthor}
                      </p>
                    )}
                  </div>

                  {/* Decorative ornament */}
                  <div className="flex items-center justify-center pt-3 opacity-30">
                    <div className="h-[1px] flex-1" style={{ backgroundColor: textColor }} />
                    <span className="mx-2 text-[10px]">✦</span>
                    <div className="h-[1px] flex-1" style={{ backgroundColor: textColor }} />
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

        </div>
      </div>

      {/* RIGHT SECTION: Interactive stacked cards & Grab button */}
      <div className="w-full md:w-[51%] h-1/2 md:h-full relative bg-transparent flex flex-col items-center justify-center px-8 md:px-16 lg:px-24 py-[var(--modal-padding-y)] overflow-hidden pointer-events-none z-20">

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
                  className={`shrink-0 object-contain aspect-square mt-2 md:mt-3 ${config.iconClass}`}
                  style={{ width: 'var(--card-icon-size)', height: 'var(--card-icon-size)' }}
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

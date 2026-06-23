import { useMemo, useState, useEffect } from 'react';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { BookCard } from './components/BookCard';
import type { Book } from './components/BookCard';
import { BookModal } from './components/BookModal';
import { Search, ChevronUp, Sun, Moon } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Logo } from './components/ui/Logo';

function generateBooks(): Book[] {
  const baseBooks = [
    { title: 'Grid Systems', author: 'Josef Müller-Brockmann', image: '/books/book_0.png', backCover: '/books/back_book_0.png', category: 'Graphic Design' },
    { title: 'Palette Perfect', author: 'Sara Caldas', image: '/books/book_1.png', backCover: '/books/back_book_1.png', category: 'Graphic Design' },
    { title: 'Expressive Type Today', author: 'Counter-Print Books', image: '/books/book_2.png', backCover: '/books/back_book_2.png', category: 'Graphic Design' },
    { title: 'Strategic Creativity', author: 'Robin Landa', image: '/books/book_3.png', backCover: '/books/back_book_3.png', category: 'Graphic Design' },
    { title: 'Logo Modernism', author: 'Jens Müller', image: '/books/book_4.png', category: 'Graphic Design' },
    { title: 'Sprint', author: 'Jake Knapp', image: '/books/book_5.png', category: 'Product Design' },
    { title: 'The Graphic Design Idea Book', author: 'Steven Heller', image: '/books/book_6.png', category: 'Graphic Design' },
    { title: 'Oh Sh*t What Now?', author: 'Craig Ward', image: '/books/book_7_new.png', category: 'Graphic Design' },
    { title: 'Design as Art', author: 'Bruno Munari', image: '/books/book_8.png', category: 'Graphic Design' },
    { title: 'NASA Graphics Standards Manual', author: 'Richard Danne', image: '/books/book_9.png', category: 'Graphic Design' },
    { title: 'The Design of Everyday Things', author: 'Don Norman', image: '/books/book_10.png', category: 'Product Design' },
    { title: 'White Space is Not Your Enemy', author: 'Kim Golombisky', image: '/books/book_11.png', backCover: '/books/back_book_11.png', category: 'Graphic Design' },
    { title: 'Graphic Design 1890-Today', author: 'Jens Müller, Julius Wiedemann', image: '/books/book_12.png', backCover: '/books/back_book_12.png', category: 'Graphic Design' },
    { title: 'The User Experience Team of One', author: 'Leah Buley', image: '/books/book_13.png', backCover: '/books/back_book_13.png', category: 'Product Design' },
    { title: 'Articulating Design Decisions', author: 'Tom Greever', image: '/books/book_14.png', category: 'Product Design' },
    { title: 'Mismatch', author: 'Kat Holmes', image: '/books/book_15.png', category: 'Product Design' },
    { title: 'User Friendly', author: 'Cliff Kuang', image: '/books/book_16.png', category: 'Product Design' },
    { title: 'Hooked', author: 'Nir Eyal', image: '/books/book_17.png', category: 'Product Design' },
    { title: 'Creative Confidence', author: 'Tom Kelley & David Kelley', image: '/books/book_18.png', category: 'Product Design', width: 222, height: 334 },
    { title: '100 Things Every Designer Needs to Know', author: 'Susan M. Weinschenk', image: '/books/book_19.png', category: 'Product Design', width: 220, height: 282 },
    { title: 'Steal Like an Artist', author: 'Austin Kleon', image: '/books/book_20.png', category: 'Product Design', width: 240, height: 240 },
    { title: 'Laws of UX', author: 'Jon Yablonski', image: '/books/book_21.png', backCover: '/books/back_book_21.png', category: 'Product Design', width: 222, height: 334 },
    { title: 'Interaction of Color', author: 'Josef Albers', image: '/books/book_22.png', backCover: '/books/back_book_22.png', category: 'Graphic Design', width: 218, height: 334 },
    { title: 'Thinking with Type', author: 'Ellen Lupton', image: '/books/book_23.png', backCover: '/books/back_book_23.png', category: 'Graphic Design', width: 275, height: 334 },
    { title: 'Geometry of Design', author: 'Kimberly Elam', image: '/books/book_24.png', backCover: '/books/back_book_24.png', category: 'Graphic Design', width: 277, height: 334 },
    { title: 'Designing Brand Identity', author: 'Alina Wheeler, Rob Meyerson', image: '/books/book_25.png', backCover: '/books/back_book_25.png', category: 'Graphic Design', width: 263, height: 334 },
    { title: 'How to Solve It', author: 'George Polya', image: '/books/book_26.png', category: 'Graphic Design', width: 218, height: 334 },
    { title: 'Visual Grammar', author: 'Christian Leborg', image: '/books/book_27.png', category: 'Graphic Design', width: 275, height: 334 },
    { title: 'Just My Type', author: 'Simon Garfield', image: '/books/book_28.png', category: 'Graphic Design', width: 217, height: 334 },
    { title: 'Graphic Design Manual', author: 'Armin Hofmann', image: '/books/book_29.png', category: 'Graphic Design', width: 286, height: 334 }
  ];

  
  const spine = "/books/spine.png";

  // Create the list of books (no duplication or infinite repetition)
  const books: Book[] = [];
  let id = 0;
  for (let i = 0; i < baseBooks.length; i++) {
    const book = baseBooks[i];
    books.push({
      id: id++,
      title: book.title,
      author: book.author,
      image: book.image,
      spine: spine,
      category: book.category,
      width: book.width,
      height: book.height
    });
  }
  return books;
}

function App() {
  const books = useMemo(() => generateBooks(), []);
  
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Graphic Design' | 'Product Design'>('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  

  const playSoftClick = (type: 'open' | 'close' = 'open') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'sine';
      if (type === 'open') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.04);
        
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else {
        // Sharper, higher frequency 'tick' for close
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.02);
        
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const handleSelectBook = (book: Book | null) => {
    playSoftClick(book ? 'open' : 'close');
    setSelectedBook(book);
  };


  // Handle dark mode class toggle on the HTML element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <LayoutGroup>
      <InfiniteCanvas>
        {/* Populating sideways (columns) using 5 rows (flows up to 6 columns) to achieve balanced horizontal/vertical scroll */}
        <div className="grid grid-rows-5 grid-flow-col gap-0 w-max h-max p-[100px] bg-[#fbfaf5] dark:bg-[#161616] transition-colors duration-700">
          {books.map((book, index) => {
            const matchesSearch = searchQuery === '' || 
              book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
              book.author.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
            const isMatched = matchesSearch && matchesCategory;
            
            // Adjusting first-row/first-col borders for vertical-column grid flow (rows=5)
            const isFirstRow = index % 5 === 0;
            const isFirstCol = index < 5;
              
            return (
              <BookCard 
                key={book.id} 
                book={book} 
                onSelect={handleSelectBook} 
                isMatched={isMatched}
                isFirstRow={isFirstRow}
                isFirstCol={isFirstCol}
              />
            );
          })}
        </div>
      </InfiniteCanvas>

      {/* Sleek Floating Navigation (Framer Motion) */}
      <div className="fixed bottom-[30px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-full bg-white/70 dark:bg-black/70 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl z-50">
        
        {/* Brand Logo */}
        <div className="pl-3.5 pr-2.5 flex items-center shrink-0">
          <Logo className="h-5 w-auto" />
        </div>

        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0" />

        {/* Book Type Filter Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-4 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className="font-semibold text-[14px] text-black dark:text-white">
              {selectedCategory === 'All' ? 'Book type' : selectedCategory}
            </span>
            <ChevronUp size={16} className={`text-black dark:text-white transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[180px] py-2 rounded-[16px] bg-white/90 dark:bg-black/90 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-xl overflow-hidden"
              >
                {['All', 'Graphic Design', 'Product Design'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat as any);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-[14px] font-medium transition-colors ${selectedCategory === cat ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white' : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0" />

        {/* Search Bar */}
        <div className="flex items-center gap-2 px-4 h-10 rounded-full bg-black/5 dark:bg-white/5 w-[200px] focus-within:ring-2 focus-within:ring-black/10 dark:focus-within:ring-white/20 transition-all">
          <Search size={18} className="text-black/50 dark:text-white/50 shrink-0" />
          <input 
            type="text" 
            placeholder="Search Books" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none font-medium text-[14px] text-black dark:text-white w-full placeholder:text-black/50 dark:placeholder:text-white/50"
          />
        </div>

        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0" />

        {/* Theme Toggle Group */}
        <div className="flex items-center gap-0.5 pr-0.5">
          <button 
            onClick={() => setTheme('light')}
            className={`relative flex items-center justify-center w-10 h-10 rounded-full z-10 transition-colors ${theme === 'light' ? 'text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'}`}
          >
            {theme === 'light' && (
              <motion.div layoutId="theme-active" className="absolute inset-0 bg-black/8 dark:bg-white/10 rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <Sun size={18} className="relative z-10" />
          </button>
          <button 
            onClick={() => setTheme('dark')}
            className={`relative flex items-center justify-center w-10 h-10 rounded-full z-10 transition-colors ${theme === 'dark' ? 'text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'}`}
          >
            {theme === 'dark' && (
              <motion.div layoutId="theme-active" className="absolute inset-0 bg-black/8 dark:bg-white/10 rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <Moon size={18} className="relative z-10" />
          </button>
        </div>

      </div>

      <AnimatePresence>
        {selectedBook && (
          <BookModal book={selectedBook} onClose={() => handleSelectBook(null)} />
        )}
      </AnimatePresence>


    </LayoutGroup>
  );
}

export default App;

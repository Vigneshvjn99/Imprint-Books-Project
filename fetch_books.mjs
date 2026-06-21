import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const books = [
  { title: 'Grid Systems', author: 'Josef Müller-Brockmann' },
  { title: 'Palette Perfect', author: 'Sara Caldas' },
  { title: 'Expressive Type Today', author: 'Counter-Print Books' },
  { title: 'Strategic Creativity', author: 'Robin Landa' },
  { title: 'Logo Modernism', author: 'Jens Müller' },
  { title: 'Sprint', author: 'Jake Knapp' },
  { title: 'The Graphic Design Idea Book', author: 'Steven Heller' },
  { title: 'Oh Sh*t What Now?', author: 'Craig Ward' },
  { title: 'Design as Art', author: 'Bruno Munari' },
  { title: 'NASA Graphics Standards Manual', author: 'Richard Danne' },
  { title: 'The Design of Everyday Things', author: 'Don Norman' },
  { title: 'White Space is Not Your Enemy', author: 'Kim Golombisky' }
];

async function downloadImage(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
}

async function main() {
  const booksDir = path.join(__dirname, 'public', 'books');
  if (!fs.existsSync(booksDir)) {
    fs.mkdirSync(booksDir, { recursive: true });
  }

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    try {
      const query = encodeURIComponent(`${book.title} ${book.author}`);
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`);
      const data = await res.json();
      
      let imageUrl = null;
      if (data.docs && data.docs.length > 0) {
        const doc = data.docs[0];
        if (doc.cover_i) {
          imageUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }
      }

      if (imageUrl) {
        const dest = path.join(booksDir, `book_${i}.jpg`);
        await downloadImage(imageUrl, dest);
        console.log(`Downloaded image for "${book.title}"`);
      } else {
        // Fallback placeholder
        const fallbackUrl = `https://placehold.co/400x600/333333/ffffff.png?text=${encodeURIComponent(book.title)}`;
        const dest = path.join(booksDir, `book_${i}.jpg`);
        await downloadImage(fallbackUrl, dest);
        console.log(`Used placeholder for "${book.title}"`);
      }
    } catch (e) {
      console.error(`Error for "${book.title}":`, e.message);
    }
  }

  try {
    const spineUrl = 'https://placehold.co/20x300/dddddd/999999.png?text=Spine';
    await downloadImage(spineUrl, path.join(booksDir, 'spine.jpg'));
    console.log('Downloaded spine image');
  } catch(e) {
    console.error('Error downloading spine', e);
  }
}

main();

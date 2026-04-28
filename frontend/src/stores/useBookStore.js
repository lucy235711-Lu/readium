import { create } from 'zustand';

// Helper: load from localStorage
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

// Helper: save to localStorage
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// Generate unique id
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// In-memory file store (File objects can't be serialized)
const fileStore = {};

const useBookStore = create((set, get) => ({
  books: load('readium_books', []),
  currentBook: null,
  highlights: [],
  reflections: [],
  loading: false,
  error: null,
  currentPage: 1,
  zoom: 1.0,

  // ── Books ──────────────────────────────────────────────
  fetchBooks: () => {
    const books = load('readium_books', []);
    set({ books });
  },

  // Called when user picks a file
  addBook: (file, title) => {
    const id = uid();
    fileStore[id] = file;
    const book = {
      id,
      title: title || file.name.replace(/\.pdf$/i, ''),
      fileName: file.name,
      fileSize: file.size,
      current_page: 1,
      total_pages: null,
      zoom: 1.0,
      createdAt: Date.now(),
    };
    const books = [book, ...load('readium_books', [])];
    save('readium_books', books);
    set({ books });
    return book;
  },

  deleteBook: (id) => {
    delete fileStore[id];
    // also remove highlights/reflections for this book
    const allH = load('readium_highlights', []);
    const allR = load('readium_reflections', []);
    save('readium_highlights', allH.filter(h => h.book_id !== id));
    save('readium_reflections', allR.filter(r => r.book_id !== id));

    const books = load('readium_books', []).filter(b => b.id !== id);
    save('readium_books', books);
    set(state => ({
      books,
      currentBook: state.currentBook?.id === id ? null : state.currentBook,
    }));
  },

  // ── Open a book ────────────────────────────────────────
  fetchBook: (id) => {
    set({ loading: true, currentBook: null, highlights: [], reflections: [], currentPage: 1, zoom: 1.0 });
    const books = load('readium_books', []);
    const book = books.find(b => b.id === id);
    if (!book) {
      set({ loading: false, error: 'Book not found' });
      return;
    }
    const highlights = load('readium_highlights', []).filter(h => h.book_id === id);
    const reflections = load('readium_reflections', []).filter(r => r.book_id === id);
    set({
      currentBook: book,
      currentPage: book.current_page || 1,
      zoom: book.zoom || 1.0,
      highlights,
      reflections,
      loading: false,
    });
  },

  // Get object URL for PDF (from in-memory fileStore)
  getFileUrl: (id) => {
    const file = fileStore[id];
    if (!file) return null;
    return URL.createObjectURL(file);
  },

  // Store file object (called when navigating to reader)
  storeFile: (id, file) => {
    fileStore[id] = file;
  },

  // ── Highlights ────────────────────────────────────────
  createHighlight: (bookId, pageNumber, content, position, color) => {
    const highlight = {
      id: uid(),
      book_id: bookId,
      page_number: pageNumber,
      content,
      position,
      color: color || 'yellow',
      createdAt: Date.now(),
    };
    const all = load('readium_highlights', []);
    all.push(highlight);
    save('readium_highlights', all);
    set(state => ({ highlights: [...state.highlights, highlight] }));
    return highlight;
  },

  deleteHighlight: (id) => {
    const all = load('readium_highlights', []).filter(h => h.id !== id);
    save('readium_highlights', all);
    const allR = load('readium_reflections', []).filter(r => r.highlight_id !== id);
    save('readium_reflections', allR);
    set(state => ({
      highlights: state.highlights.filter(h => h.id !== id),
      reflections: state.reflections.filter(r => r.highlight_id !== id),
    }));
  },

  // ── Reflections ───────────────────────────────────────
  createReflection: ({ highlightId, bookId, agentStyle, userNote, reflection, recommendations }) => {
    const obj = {
      id: uid(),
      highlight_id: highlightId,
      book_id: bookId,
      agent_style: agentStyle,
      user_note: userNote,
      reflection,
      recommendations: recommendations || [],
      conversation: [],
      createdAt: Date.now(),
    };
    const all = load('readium_reflections', []);
    all.push(obj);
    save('readium_reflections', all);
    set(state => ({ reflections: [...state.reflections, obj] }));
    return obj;
  },

  updateConversation: (reflectionId, conversation) => {
    const all = load('readium_reflections', []).map(r =>
      r.id === reflectionId ? { ...r, conversation } : r
    );
    save('readium_reflections', all);
    set(state => ({
      reflections: state.reflections.map(r =>
        r.id === reflectionId ? { ...r, conversation } : r
      ),
    }));
  },

  // ── Page / Zoom ───────────────────────────────────────
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),

  updateProgress: () => {
    const { currentBook, currentPage, zoom } = get();
    if (!currentBook) return;
    const books = load('readium_books', []).map(b =>
      b.id === currentBook.id ? { ...b, current_page: currentPage, zoom } : b
    );
    save('readium_books', books);
    set({ books });
  },

  setTotalPages: (total) => {
    const { currentBook } = get();
    if (!currentBook) return;
    const books = load('readium_books', []).map(b =>
      b.id === currentBook.id ? { ...b, total_pages: total } : b
    );
    save('readium_books', books);
    set(state => ({
      books,
      currentBook: { ...state.currentBook, total_pages: total },
    }));
  },
}));

export default useBookStore;

import { create } from 'zustand';
import * as api from '../services/api';

const useBookStore = create((set, get) => ({
  // State
  books: [],
  currentBook: null,
  notes: [],
  highlights: [],
  reflections: [],
  loading: false,
  error: null,
  currentPage: 1,
  zoom: 1.0,

  // Actions
  fetchBooks: async () => {
    set({ loading: true, error: null });
    try {
      const books = await api.getBooks();
      set({ books, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch books', loading: false });
    }
  },

  fetchBook: async (id) => {
    // Clear previous book's data immediately before loading new one
    set({
      loading: true,
      error: null,
      currentBook: null,
      highlights: [],
      reflections: [],
      currentPage: 1,
      zoom: 1.0,
    });
    try {
      const book = await api.getBook(id);
      set({
        currentBook: book,
        currentPage: book.current_page || 1,
        zoom: book.zoom || 1.0,
        loading: false,
      });
      // Fetch data scoped to this specific book
      const [highlights, reflections] = await Promise.all([
        api.getHighlights(book.id),
        api.getReflections(book.id),
      ]);
      set({ highlights, reflections });
    } catch (error) {
      set({ error: 'Failed to fetch book', loading: false });
    }
  },

  uploadBook: async (file, title, author) => {
    set({ loading: true, error: null });
    try {
      const book = await api.uploadBook(file, title, author);
      set(state => ({
        books: [book, ...state.books],
        loading: false
      }));
      return book;
    } catch (error) {
      set({ error: 'Failed to upload book', loading: false });
      throw error;
    }
  },

  deleteBook: async (id) => {
    try {
      await api.deleteBook(id);
      set(state => ({
        books: state.books.filter(b => b.id !== id),
        currentBook: state.currentBook?.id === id ? null : state.currentBook
      }));
    } catch (error) {
      set({ error: 'Failed to delete book' });
    }
  },

  // Notes
  fetchNotes: async (bookId) => {
    try {
      const notes = await api.getNotes(bookId);
      set({ notes });
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  },

  createNote: async (bookId, content, title, pageNumber, highlightId) => {
    try {
      const note = await api.createNote(bookId, content, title, pageNumber, highlightId);
      set(state => ({ notes: [note, ...state.notes] }));
      return note;
    } catch (error) {
      set({ error: 'Failed to create note' });
      throw error;
    }
  },

  deleteNote: async (id) => {
    try {
      await api.deleteNote(id);
      set(state => ({
        notes: state.notes.filter(n => n.id !== id)
      }));
    } catch (error) {
      set({ error: 'Failed to delete note' });
    }
  },

  // Highlights
  fetchHighlights: async (bookId) => {
    try {
      const highlights = await api.getHighlights(bookId);
      set({ highlights });
    } catch (error) {
      console.error('Failed to fetch highlights:', error);
    }
  },

  createHighlight: async (bookId, pageNumber, content, position, color) => {
    try {
      const highlight = await api.createHighlight(bookId, pageNumber, content, position, color);
      set(state => ({ highlights: [...state.highlights, highlight] }));
      return highlight;
    } catch (error) {
      set({ error: 'Failed to create highlight' });
      throw error;
    }
  },

  deleteHighlight: async (id) => {
    try {
      await api.deleteHighlight(id);
      set(state => ({
        highlights: state.highlights.filter(h => h.id !== id),
        reflections: state.reflections.filter(r => r.highlight_id !== id),
      }));
    } catch (error) {
      set({ error: 'Failed to delete highlight' });
    }
  },

  // Reflections
  createReflection: async ({ highlightId, bookId, agentStyle, userNote, reflection, recommendations }) => {
    try {
      const created = await api.createReflection({
        highlightId, bookId, agentStyle, userNote, reflection, recommendations, conversation: []
      });
      set(state => ({ reflections: [...state.reflections, created] }));
      return created;
    } catch (error) {
      set({ error: 'Failed to save reflection' });
      throw error;
    }
  },

  updateConversation: async (reflectionId, conversation) => {
    try {
      const updated = await api.updateConversation(reflectionId, conversation);
      set(state => ({
        reflections: state.reflections.map(r => r.id === reflectionId ? updated : r)
      }));
      return updated;
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  },

  // Page & Zoom
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),

  // Update progress
  updateProgress: async () => {
    const { currentBook, currentPage, zoom } = get();
    if (currentBook) {
      try {
        await api.updateProgress(currentBook.id, currentPage, zoom);
      } catch (error) {
        console.error('Failed to update progress:', error);
      }
    }
  }
}));

export default useBookStore;
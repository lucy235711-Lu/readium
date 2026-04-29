import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// In-memory file store (File objects can't be serialized)
const fileStore = {};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const useBookStore = create((set, get) => ({
  books: [],
  currentBook: null,
  highlights: [],
  reflections: [],
  loading: false,
  error: null,
  currentPage: 1,
  zoom: 1.0,

  // ── Books ──────────────────────────────────────────────
  fetchBooks: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) set({ books: data || [], loading: false });
    else set({ loading: false });
  },

  addBook: async (file, title) => {
    const { data: { user } } = await supabase.auth.getUser();
    const id = uid();
    fileStore[id] = file;

    // Upload PDF to Supabase Storage
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const filePath = `${user.id}/${id}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file);

    if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

    const book = {
      id,
      user_id: user.id,
      title: title || file.name.replace(/\.pdf$/i, ''),
      file_name: file.name,
      file_path: filePath,
      current_page: 1,
      total_pages: null,
      zoom: 1.0,
    };

    const { data, error } = await supabase.from('books').insert(book).select().single();
    if (error) throw error;

    set(state => ({ books: [data, ...state.books] }));
    return data;
  },

  deleteBook: async (id) => {
    const book = get().books.find(b => b.id === id);
    if (book?.file_path) {
      await supabase.storage.from('pdfs').remove([book.file_path]);
    }
    delete fileStore[id];
    await supabase.from('books').delete().eq('id', id);
    set(state => ({
      books: state.books.filter(b => b.id !== id),
      currentBook: state.currentBook?.id === id ? null : state.currentBook,
    }));
  },

  // ── Open a book ────────────────────────────────────────
  fetchBook: async (id) => {
    set({ loading: true, currentBook: null, highlights: [], reflections: [], currentPage: 1, zoom: 1.0 });

    const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error || !book) { set({ loading: false }); return; }

    const [{ data: highlights }, { data: reflections }] = await Promise.all([
      supabase.from('highlights').select('*').eq('book_id', id).order('created_at'),
      supabase.from('reflections').select('*').eq('book_id', id).order('created_at'),
    ]);

    set({
      currentBook: book,
      currentPage: book.current_page || 1,
      zoom: book.zoom || 1.0,
      highlights: highlights || [],
      reflections: reflections || [],
      loading: false,
    });
  },

  // Get file URL — from Supabase Storage
  getFileUrl: async (id) => {
    if (fileStore[id]) return URL.createObjectURL(fileStore[id]);
    const book = get().books.find(b => b.id === id) || get().currentBook;
    if (!book?.file_path) return null;
    const { data } = await supabase.storage.from('pdfs').createSignedUrl(book.file_path, 3600);
    return data?.signedUrl || null;
  },

  storeFile: (id, file) => { fileStore[id] = file; },

  // ── Highlights ────────────────────────────────────────
  createHighlight: async (bookId, pageNumber, content, position, color) => {
    const { data: { user } } = await supabase.auth.getUser();
    const highlight = {
      id: uid(),
      user_id: user.id,
      book_id: bookId,
      page_number: pageNumber,
      content,
      position,
      color: color || 'yellow',
    };
    const { data, error } = await supabase.from('highlights').insert(highlight).select().single();
    if (error) throw error;
    set(state => ({ highlights: [...state.highlights, data] }));
    return data;
  },

  deleteHighlight: async (id) => {
    await supabase.from('highlights').delete().eq('id', id);
    set(state => ({
      highlights: state.highlights.filter(h => h.id !== id),
      reflections: state.reflections.filter(r => r.highlight_id !== id),
    }));
  },

  // ── Reflections ───────────────────────────────────────
  createReflection: async ({ highlightId, bookId, agentStyle, userNote, reflection, recommendations }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const obj = {
      id: uid(),
      user_id: user.id,
      highlight_id: highlightId,
      book_id: bookId,
      agent_style: agentStyle,
      user_note: userNote,
      reflection,
      recommendations: recommendations || [],
      conversation: [],
    };
    const { data, error } = await supabase.from('reflections').insert(obj).select().single();
    if (error) throw error;
    set(state => ({ reflections: [...state.reflections, data] }));
    return data;
  },

  updateConversation: async (reflectionId, conversation) => {
    const { data, error } = await supabase
      .from('reflections')
      .update({ conversation })
      .eq('id', reflectionId)
      .select()
      .single();
    if (!error) {
      set(state => ({
        reflections: state.reflections.map(r => r.id === reflectionId ? data : r),
      }));
    }
  },

  // ── Page / Zoom ───────────────────────────────────────
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),

  updateProgress: async () => {
    const { currentBook, currentPage, zoom } = get();
    if (!currentBook) return;
    await supabase.from('books').update({ current_page: currentPage, zoom }).eq('id', currentBook.id);
    set(state => ({
      books: state.books.map(b => b.id === currentBook.id ? { ...b, current_page: currentPage, zoom } : b),
    }));
  },

  setTotalPages: async (total) => {
    const { currentBook } = get();
    if (!currentBook) return;
    await supabase.from('books').update({ total_pages: total }).eq('id', currentBook.id);
    set(state => ({
      books: state.books.map(b => b.id === currentBook.id ? { ...b, total_pages: total } : b),
      currentBook: { ...state.currentBook, total_pages: total },
    }));
  },
}));

export default useBookStore;

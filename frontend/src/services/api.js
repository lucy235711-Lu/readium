import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Automatically attach Supabase token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export async function generateReflection({
  sourceText,
  contextBefore = '',
  contextAfter = '',
  userNote = '',
  style = 'philosophy',
  provider = 'openai',
  highlightId,
  bookId,
  bookTitle,
}) {
  const { data } = await api.post('/ai/generate', {
    sourceText, contextBefore, contextAfter, userNote, style, provider,
    highlightId, bookId, bookTitle,
  });
  return data;
}

export async function chatWithReflection({ sourceText, userNote, initialReflection, conversation, style = 'philosophy' }) {
  const { data } = await api.post('/ai/chat', {
    sourceText, userNote, initialReflection, conversation, style,
  });
  return data;
}

export async function getConcepts(params = {}) {
  const { data } = await api.get('/concepts', { params });
  return data;
}

export async function getRecentConcepts(days = 30) {
  const { data } = await api.get('/concepts/recent', { params: { days } });
  return data;
}

export async function getConceptsByBook() {
  const { data } = await api.get('/concepts/by-book');
  return data;
}

export async function generateDigest(payload) {
  const { data } = await api.post('/digest/digest', payload);
  return data;
}

export default api;

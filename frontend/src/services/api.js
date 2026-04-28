import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

export async function getBooks() {
  const { data } = await api.get('/books');
  return data;
}

export async function getBook(id) {
  const { data } = await api.get(`/books/${id}`);
  return data;
}

export async function uploadBook(file, title, author) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  if (author) formData.append('author', author);
  const { data } = await api.post('/books', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
}

export async function deleteBook(id) {
  await api.delete(`/books/${id}`);
}

export async function updateProgress(id, currentPage, zoom) {
  await api.put(`/books/${id}/progress`, { current_page: currentPage, zoom });
}

export async function getHighlights(bookId) {
  const { data } = await api.get(`/highlights/book/${bookId}`);
  return data;
}

export async function createHighlight(bookId, pageNumber, content, position, color) {
  const { data } = await api.post('/highlights', {
    bookId, pageNumber, content, position, color
  });
  return data;
}

export async function deleteHighlight(id) {
  await api.delete(`/highlights/${id}`);
}

export async function getReflections(bookId, style) {
  const params = style ? `?style=${style}` : '';
  const { data } = await api.get(`/reflections/book/${bookId}${params}`);
  return data;
}

export async function createReflection({ highlightId, bookId, agentStyle, userNote, reflection, recommendations, conversation }) {
  const { data } = await api.post('/reflections', {
    highlightId, bookId, agentStyle, userNote, reflection, recommendations, conversation: conversation || []
  });
  return data;
}

export async function updateConversation(reflectionId, conversation) {
  const { data } = await api.patch(`/reflections/${reflectionId}/conversation`, { conversation });
  return data;
}

export async function deleteReflection(id) {
  await api.delete(`/reflections/${id}`);
}

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

export default api;
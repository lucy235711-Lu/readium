import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { initDatabase, getAll, getOne, run } from './models/database.js';

import booksRouter from './routes/books.js';
import notesRouter from './routes/notes.js';
import highlightsRouter from './routes/highlights.js';
import aiRouter from './routes/ai.js';
import reflectionsRouter from './routes/reflections.js';
import conceptsRouter from './routes/concepts.js';
import digestRouter from './routes/digest.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded PDFs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files (built by Vite)
const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist));

// Initialize database
await initDatabase();

// API routes
app.use('/api/books', booksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/highlights', highlightsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai', digestRouter);
app.use('/api/reflections', reflectionsRouter);
app.use('/api/concepts', conceptsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — must be AFTER all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { getAll, getOne, run };
export default app;

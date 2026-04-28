import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getAll, getOne, run } from '../models/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Get all books
router.get('/', (req, res) => {
  try {
    const books = getAll('SELECT * FROM books ORDER BY created_at DESC');
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single book
router.get('/:id', (req, res) => {
  try {
    const book = getOne('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload book
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, author } = req.body;
    const filePath = req.file.filename;

    const result = run(
      'INSERT INTO books (title, author, file_path) VALUES (?, ?, ?)',
      [title, author || '', filePath]
    );

    const book = getOne('SELECT * FROM books WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete book
router.delete('/:id', (req, res) => {
  try {
    const book = getOne('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Delete file
    const filePath = path.join(__dirname, '..', 'uploads', book.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Explicitly delete all related data (cascade fallback for sql.js)
    run('DELETE FROM user_concepts WHERE book_id = ?', [req.params.id]);
    run('DELETE FROM reflections WHERE book_id = ?', [req.params.id]);
    run('DELETE FROM notes WHERE book_id = ?', [req.params.id]);
    run('DELETE FROM highlights WHERE book_id = ?', [req.params.id]);

    // Delete from database
    run('DELETE FROM books WHERE id = ?', [req.params.id]);

    res.json({ message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update reading progress
router.put('/:id/progress', (req, res) => {
  try {
    const { current_page, zoom } = req.body;

    run(
      'UPDATE books SET current_page = ?, zoom = ?, updated_at = datetime("now") WHERE id = ?',
      [current_page, zoom, req.params.id]
    );

    const book = getOne('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
import express from 'express';
import { getAll, getOne, run } from '../models/database.js';

const router = express.Router();

// Get highlights for a book
router.get('/book/:bookId', (req, res) => {
  try {
    const highlights = getAll(
      'SELECT * FROM highlights WHERE book_id = ? ORDER BY created_at DESC',
      [req.params.bookId]
    );
    res.json(highlights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create highlight
router.post('/', (req, res) => {
  try {
    const { bookId, pageNumber, content, position, color } = req.body;

    const result = run(
      'INSERT INTO highlights (book_id, page_number, content, position, color) VALUES (?, ?, ?, ?, ?)',
      [bookId, pageNumber, content, position, color || '#FFEB3B']
    );

    const highlight = getOne('SELECT * FROM highlights WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(highlight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete highlight
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM highlights WHERE id = ?', [req.params.id]);
    res.json({ message: 'Highlight deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
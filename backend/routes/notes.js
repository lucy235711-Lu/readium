import express from 'express';
import { getAll, getOne, run } from '../models/database.js';

const router = express.Router();

// Get notes for a book
router.get('/book/:bookId', (req, res) => {
  try {
    const notes = getAll(
      'SELECT * FROM notes WHERE book_id = ? ORDER BY created_at DESC',
      [req.params.bookId]
    );
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create note
router.post('/', (req, res) => {
  try {
    const { bookId, title, content, pageNumber, highlightId } = req.body;

    const result = run(
      'INSERT INTO notes (book_id, title, content, page_number, highlight_id) VALUES (?, ?, ?, ?, ?)',
      [bookId, title || null, content, pageNumber || null, highlightId || null]
    );

    const note = getOne('SELECT * FROM notes WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
import express from 'express';
import { getAll, getOne, run } from '../models/database.js';

const router = express.Router();

// Get all reflections for a book, optionally filtered by agent_style
router.get('/book/:bookId', (req, res) => {
  try {
    const { style } = req.query;
    const reflections = style
      ? getAll(
          'SELECT * FROM reflections WHERE book_id = ? AND agent_style = ? ORDER BY created_at ASC',
          [req.params.bookId, style]
        )
      : getAll(
          'SELECT * FROM reflections WHERE book_id = ? ORDER BY created_at ASC',
          [req.params.bookId]
        );

    const parsed = reflections.map(r => ({
      ...r,
      recommendations: JSON.parse(r.recommendations || '[]'),
      conversation: JSON.parse(r.conversation || '[]'),
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reflection by highlight_id + agent_style
router.get('/highlight/:highlightId', (req, res) => {
  try {
    const { style = 'philosophy' } = req.query;
    const r = getOne(
      'SELECT * FROM reflections WHERE highlight_id = ? AND agent_style = ?',
      [req.params.highlightId, style]
    );
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...r,
      recommendations: JSON.parse(r.recommendations || '[]'),
      conversation: JSON.parse(r.conversation || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create reflection
router.post('/', (req, res) => {
  try {
    const { highlightId, bookId, agentStyle, userNote, reflection, recommendations, conversation } = req.body;

    if (!highlightId || !bookId || !reflection || !agentStyle) {
      return res.status(400).json({ error: 'highlightId, bookId, agentStyle, reflection are required' });
    }

    const result = run(
      `INSERT INTO reflections (highlight_id, book_id, agent_style, user_note, reflection, recommendations, conversation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        highlightId,
        bookId,
        agentStyle,
        userNote || '',
        reflection,
        JSON.stringify(recommendations || []),
        JSON.stringify(conversation || []),
      ]
    );

    const created = getOne('SELECT * FROM reflections WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({
      ...created,
      recommendations: JSON.parse(created.recommendations || '[]'),
      conversation: JSON.parse(created.conversation || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update conversation
router.patch('/:id/conversation', (req, res) => {
  try {
    const { conversation } = req.body;
    run(
      `UPDATE reflections SET conversation = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(conversation), req.params.id]
    );
    const updated = getOne('SELECT * FROM reflections WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      recommendations: JSON.parse(updated.recommendations || '[]'),
      conversation: JSON.parse(updated.conversation || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete reflection
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM reflections WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
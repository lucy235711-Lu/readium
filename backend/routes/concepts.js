import express from 'express';
import { getAll, getOne } from '../models/database.js';

const router = express.Router();

// Get all concepts (for 知音对话 digest generation)
router.get('/', (req, res) => {
  try {
    const { limit = 100, since } = req.query;

    const concepts = since
      ? getAll(
          `SELECT * FROM user_concepts WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`,
          [since, parseInt(limit)]
        )
      : getAll(
          `SELECT * FROM user_concepts ORDER BY created_at DESC LIMIT ?`,
          [parseInt(limit)]
        );

    res.json(concepts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get concepts grouped by book (for 颅内世界 map)
router.get('/by-book', (req, res) => {
  try {
    const books = getAll(`
      SELECT
        uc.book_id,
        uc.book_title,
        COUNT(*) as concept_count,
        GROUP_CONCAT(uc.concept, '|||') as concepts_raw,
        GROUP_CONCAT(COALESCE(uc.source_text, h.content, ''), '|||') as sources_raw,
        GROUP_CONCAT(COALESCE(uc.page_number, h.page_number, ''), '|||') as pages_raw
      FROM user_concepts uc
      LEFT JOIN highlights h ON uc.highlight_id = h.id
      GROUP BY uc.book_id
      ORDER BY concept_count DESC
    `);

 const result = books.map(b => {
  const conceptArr = b.concepts_raw ? b.concepts_raw.split('|||') : [];
  const sourceArr  = b.sources_raw  ? b.sources_raw.split('|||')  : [];
  const pageArr    = b.pages_raw    ? b.pages_raw.split('|||')    : [];
  return {
    bookId: b.book_id,
    bookTitle: b.book_title,
    conceptCount: b.concept_count,
    concepts: conceptArr.map((con, i) => ({
      concept: con,
      sourceText: sourceArr[i] || '',
      page: pageArr[i] || '',
    })),
  };
});

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent concepts for digest (last N days)
router.get('/recent', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const concepts = getAll(
      `SELECT uc.*, h.content as highlight_content
       FROM user_concepts uc
       LEFT JOIN highlights h ON uc.highlight_id = h.id
       WHERE uc.created_at >= ?
       ORDER BY uc.created_at DESC`,
      [since]
    );

    // Group by book for easier consumption by AI digest
    const byBook = {};
    for (const c of concepts) {
      if (!byBook[c.book_id]) {
        byBook[c.book_id] = {
          bookId: c.book_id,
          bookTitle: c.book_title,
          concepts: [],
        };
      }
      byBook[c.book_id].concepts.push({
        concept: c.concept,
        context: c.context,
        agentStyle: c.agent_style,
        highlightContent: c.highlight_content,
        createdAt: c.created_at,
      });
    }

    res.json({
      since,
      books: Object.values(byBook),
      totalConcepts: concepts.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
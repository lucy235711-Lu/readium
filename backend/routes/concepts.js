import express from 'express';
import { supabase, getUserFromRequest } from '../lib/supabaseAdmin.js';

const router = express.Router();

// Get all concepts
router.get('/', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { limit = 100 } = req.query;
    let query = supabase
      .from('user_concepts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (req.query.since) query = query.gte('created_at', req.query.since);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get concepts grouped by book
router.get('/by-book', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('user_concepts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const byBook = {};
    for (const c of (data || [])) {
      if (!byBook[c.book_id]) {
        byBook[c.book_id] = {
          bookId: c.book_id,
          bookTitle: c.book_title,
          conceptCount: 0,
          concepts: [],
        };
      }
      byBook[c.book_id].concepts.push({
        concept: c.concept,
        sourceText: c.source_text || '',
        page: '',
      });
      byBook[c.book_id].conceptCount++;
    }

    res.json(Object.values(byBook));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent concepts for digest
router.get('/recent', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('user_concepts')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const byBook = {};
    for (const c of (data || [])) {
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
        createdAt: c.created_at,
      });
    }

    res.json({
      since,
      books: Object.values(byBook),
      totalConcepts: (data || []).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a concept (called from ai.js)
router.post('/', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { bookId, bookTitle, highlightId, agentStyle, concept, context, sourceText } = req.body;

    const { error } = await supabase.from('user_concepts').insert({
      user_id: user.id,
      book_id: bookId,
      book_title: bookTitle,
      highlight_id: highlightId,
      agent_style: agentStyle,
      concept,
      context,
      source_text: sourceText,
    });

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

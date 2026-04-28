import express from 'express';
import AgentFactory from '../agents/agentFactory.js';
import { supabase, getUserFromRequest } from '../lib/supabaseAdmin.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const {
      style = 'philosophy',
      provider = 'openai',
      sourceText,
      contextBefore = '',
      contextAfter = '',
      userNote = '',
      userNotes,
      highlightContent,
      highlightId,
      bookId,
      bookTitle,
    } = req.body;

    const resolvedSource = sourceText || highlightContent || '';
    const resolvedNote = userNote || userNotes || '';

    if (!resolvedSource && !resolvedNote) {
      return res.status(400).json({ error: 'sourceText is required' });
    }

    if (!['classic', 'modern', 'science', 'philosophy'].includes(style)) {
      return res.status(400).json({ error: 'Invalid style' });
    }

    const apiKey = provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: `API key not configured for: ${provider}` });
    }

    const agent = AgentFactory.createAgent(style, { provider });
    const result = await agent.generateReflection({
      sourceText: resolvedSource,
      contextBefore,
      contextAfter,
      userNote: resolvedNote,
    });

    let reflection = result.content;
    let recommendations = getRecommendations(style);

    try {
      const clean = result.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.reflection) reflection = parsed.reflection;
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        recommendations = parsed.recommendations;
      }
    } catch (e) {
      console.warn('AI response was not valid JSON, using raw content');
    }

    res.json({
      reflection,
      recommendations,
      metadata: { style, provider: result.provider, generatedAt: new Date().toISOString() },
    });

    // Async: extract concepts and save to Supabase
    if (highlightId && bookId) {
      setImmediate(async () => {
        try {
          // Get user from token
          const user = await getUserFromRequest(req);
          if (!user) return;

          const concepts = await agent.extractConcepts({
            sourceText: resolvedSource,
            userNote: resolvedNote,
            reflectionText: reflection,
          });

          const title = bookTitle || `Book ${bookId}`;

          for (const { concept, context } of concepts) {
            if (!concept || !context) continue;
            await supabase.from('user_concepts').insert({
              user_id: user.id,
              book_id: bookId,
              book_title: title,
              highlight_id: highlightId,
              agent_style: style,
              concept,
              context,
              source_text: resolvedSource,
            });
          }

          console.log(`Extracted ${concepts.length} concepts for highlight ${highlightId}`);
        } catch (err) {
          console.warn('Async concept extraction error:', err.message);
        }
      });
    }

  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { style = 'philosophy', sourceText, userNote = '', initialReflection, conversation = [] } = req.body;

    if (!sourceText || !initialReflection || conversation.length === 0) {
      return res.status(400).json({ error: 'sourceText, initialReflection, and conversation are required' });
    }

    const agent = AgentFactory.createAgent(style, { provider: 'openai' });
    const result = await agent.generateChat({ sourceText, userNote, initialReflection, conversation });

    let reply = result.content;
    try {
      const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.reflection) reply = parsed.reflection;
    } catch {
      // not JSON, use as-is
    }

    res.json({ reply });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/styles', (req, res) => {
  res.json({ styles: AgentFactory.getAvailableStyles(), providers: AgentFactory.getAvailableProviders() });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
  });
});

function getRecommendations(style) {
  const recs = {
    classic: [
      { title: '《红楼梦》', author: '曹雪芹', reason: '中国古典文学巅峰之作' },
      { title: '《诗经》', author: 'Anonymous', reason: '中国诗歌的原始形态' },
    ],
    modern: [
      { title: '《百年孤独》', author: '马尔克斯', reason: '魔幻现实主义的核心文本' },
      { title: '《局外人》', author: '加缪', reason: '荒诞感的文学化表达' },
    ],
    science: [
      { title: '《自私的基因》', author: '道金斯', reason: '进化论视角的生命科学入门' },
      { title: '《科学革命的结构》', author: '库恩', reason: '理解科学范式如何演变' },
    ],
    philosophy: [
      { title: '《存在与虚无》', author: '萨特', reason: '存在主义的系统性论述' },
      { title: '《日常生活中的自我呈现》', author: '戈夫曼', reason: '社会互动与身份表演的社会学基础' },
    ],
  };
  return recs[style] || recs.philosophy;
}

export default router;

import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

// DeepSeek is OpenAI-compatible
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : undefined,
});

router.post('/digest', async (req, res) => {
  try {
    const { concepts, extraBooks = [], extraMusic = [], extraFilms = [] } = req.body;

    if (!concepts || concepts.totalConcepts === 0) {
      return res.json({
        journal: '你最近的阅读记录还很空。开始阅读并标记重点，我会帮你记录思维的轨迹。',
        crossInsight: null,
      });
    }

    const booksSection = concepts.books.map(b =>
      `《${b.bookTitle}》：${b.concepts.map(c => `${c.concept}（${c.context}）`).join('、')}`
    ).join('\n');

    const extrasSection = [
      extraBooks.length > 0 ? `另外读了：${extraBooks.join('、')}` : '',
      extraMusic.length > 0 ? `最近在听：${extraMusic.join('、')}` : '',
      extraFilms.length > 0 ? `最近看了：${extraFilms.join('、')}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `以下是一个读者过去一个月的阅读痕迹：

${booksSection}
${extrasSection ? '\n' + extrasSection : ''}

请完成两个任务：

任务1：阅读日志（80-100字）
写一段手写日记感觉的近期阅读总结。要：
* 发现读者自己可能没有意识到的主题或意象的反复出现
* 语气像一个懂你的朋友，不是评论员
* 可以提到具体书名或概念词
* 如果有音乐/电影，自然融入

任务2：跨媒介洞察（60-70字，仅在有多本书或媒介时生成）
如果有跨书或跨媒介的连接，写一句精炼的跨领域观察。如果连接太牵强则留空。

只返回合法 JSON，不加任何其他文字：
{ "journal": "阅读日志正文", "crossInsight": "跨媒介洞察，或 null" }`;

    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 600,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.json({
      journal: parsed.journal || '',
      crossInsight: parsed.crossInsight || null,
    });

  } catch (err) {
    console.error('Digest error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

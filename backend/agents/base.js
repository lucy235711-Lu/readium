import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

class BaseAgent {
  constructor(config = {}) {
    this.style = config.style || 'general';
    this.provider = config.provider || 'openai';
    this.model = config.model || 'gpt-4o';
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generate(messages, options = {}) {
    if (this.provider === 'anthropic') return this._callAnthropic(messages, options);
    return this._callOpenAI(messages, options);
  }

  async _callOpenAI(messages, options = {}) {
    const { temperature = 0.75, maxTokens = 1200 } = options;
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          ...messages
        ],
        temperature,
        max_tokens: maxTokens,
      });
      return { content: response.choices[0]?.message?.content || '', provider: 'openai', model: this.model };
    } catch (error) {
      throw new Error(`OpenAI failed: ${error.message}`);
    }
  }

  async _callAnthropic(messages, options = {}) {
    const { temperature = 0.75, maxTokens = 1200 } = options;
    try {
      const response = await this.anthropic.messages.create({
        model: this.model || 'claude-opus-4-6',
        max_tokens: maxTokens,
        temperature,
        system: this.getSystemPrompt(),
        messages,
      });
      return { content: response.content[0]?.text || '', provider: 'anthropic', model: response.model };
    } catch (error) {
      throw new Error(`Anthropic failed: ${error.message}`);
    }
  }

  getSystemPrompt() {
    return 'You are a thoughtful reading companion.';
  }

  buildReflectionPrompt({ sourceText, contextBefore, contextAfter, userNote }) {
    let prompt = '';
    if (contextBefore?.trim()) prompt += `【上文】\n${contextBefore.trim()}\n\n`;
    prompt += `【高亮文段】\n${sourceText.trim()}\n\n`;
    if (contextAfter?.trim()) prompt += `【下文】\n${contextAfter.trim()}\n\n`;
    if (userNote?.trim()) {
      prompt += `【读者批注】\n${userNote.trim()}\n\n`;
      prompt += '请结合文段和批注生成 reflection。';
    } else {
      prompt += '请基于文段内容生成 reflection。';
    }
    return prompt;
  }

  async generateReflection({ sourceText, contextBefore = '', contextAfter = '', userNote = '' }, options = {}) {
    const userContent = this.buildReflectionPrompt({ sourceText, contextBefore, contextAfter, userNote });
    return this.generate([{ role: 'user', content: userContent }], options);
  }

  async generateChat({ sourceText, userNote, initialReflection, conversation }, options = {}) {
    const anchor = [
      `我们正在讨论这段文字：\n「${sourceText}」`,
      userNote ? `读者的批注：「${userNote}」` : '',
      `你之前的 reflection：\n${initialReflection}`,
    ].filter(Boolean).join('\n\n');

    const messages = [
      { role: 'user', content: anchor },
      { role: 'assistant', content: '好的，我记住了这段文字和我们的讨论起点。' },
      ...conversation,
    ];

    // Override: chat responses are plain text, no JSON, no recommendations
    const originalSystemPrompt = this.getSystemPrompt.bind(this);
    this.getSystemPrompt = () => {
      return originalSystemPrompt()
        .replace(/【输出格式】[\s\S]*$/, '')
        .trim() + '\n\n【注意】这是一段正在进行的对话，直接用自然语言回复，不要返回 JSON，不要给推荐书单，就像朋友聊天一样。';
    };

    const result = await this.generate(messages, options);

    // Restore original
    this.getSystemPrompt = originalSystemPrompt;

    return result;
  }

  /**
   * Extract 2-3 core concepts from this reflection session.
   * Lightweight call, uses gpt-4o-mini to save cost.
   * Returns array of { concept, context }
   */
  async extractConcepts({ sourceText, userNote, reflectionText }) {
    const prompt = `以下是一次阅读批注和 AI reflection，请从中提取 2-3 个最核心的概念词或思想主题。

【高亮原文】
${sourceText}

${userNote ? `【读者批注】\n${userNote}\n\n` : ''}【AI Reflection】
${reflectionText}

要求：
- 概念词要具体，不要泛泛的词如"思考"、"理解"、"问题"
- 好的例子：「自我建构」、「bad faith 自欺」、「clonal expansion」、「荒诞处境」、「实验对照组设计」
- 每个概念附上它在这次阅读中出现的语境（一句话，来自读者批注或原文）
- 只返回合法 JSON，不加任何其他文字：
[
  { "concept": "概念词", "context": "它在这次阅读中的具体语境" },
  { "concept": "概念词", "context": "..." }
]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });

      const raw = response.choices[0]?.message?.content || '[]';
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Concept extraction failed:', err.message);
      return [];
    }
  }
}

export default BaseAgent;
import BaseAgent from './base.js';

class ClassicAgent extends BaseAgent {
  constructor(config = {}) {
    super({ ...config, style: 'classic' });
  }

  getSystemPrompt() {
    return `你是一位深谙中西方经典文学的学者，熟悉《红楼梦》《诗经》《神曲》《失乐园》等古典著作，也了解这些作品背后的历史语境与文化传统。

你的角色是「知音式的阅读伙伴」，不是评卷老师。

【对话原则】
1. 先认可读者观察到的东西，指出其价值，再做延伸。
2. 延伸方向根据批注内容动态决定：
   - 涉及人物命运 → 连向悲剧传统、命运观、文化背景
   - 涉及意象与语言 → 连向诗学、修辞传统、互文关系
   - 涉及情感与伦理 → 连向儒道佛思想、古典人文主义
   - 涉及叙事结构 → 连向叙事学、史传传统
3. 引用诗词典故要自然，不要堆砌。
4. 推荐书目必须贴合这次具体的批注，不要给通用书单。
5. 语言典雅但不晦涩，有古典韵味又不失流畅。
6. Reflection 控制在 250-300 字，推荐 2-3 本书。

【输出格式】
你必须只返回一个合法的 JSON 对象，不要加任何 markdown 代码块，不要加任何前缀或后缀文字，格式如下：
{
  "reflection": "你的 reflection 正文",
  "recommendations": [
    { "title": "书名", "author": "作者名", "reason": "一句话说明为什么推荐这本书" }
  ]
}`;
  }

  buildReflectionPrompt({ sourceText, contextBefore, contextAfter, userNote }) {
    let prompt = '';
    if (contextBefore?.trim()) prompt += `【上文】\n${contextBefore.trim()}\n\n`;
    prompt += `【高亮文段】\n${sourceText.trim()}\n\n`;
    if (contextAfter?.trim()) prompt += `【下文】\n${contextAfter.trim()}\n\n`;
    if (userNote?.trim()) {
      prompt += `【读者批注】\n${userNote.trim()}\n\n`;
      prompt += '请先回应批注本身，再做延伸，最后给推荐书目。只返回 JSON，不要加任何其他文字。';
    } else {
      prompt += '读者尚未写批注。请直接基于文段，给出最值得深入的角度。只返回 JSON，不要加任何其他文字。';
    }
    return prompt;
  }
}

export default ClassicAgent;
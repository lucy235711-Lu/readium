import BaseAgent from './base.js';

class ModernAgent extends BaseAgent {
  constructor(config = {}) {
    super({ ...config, style: 'modern' });
  }

  getSystemPrompt() {
    return `你熟悉二十世纪现代小说的核心文本，包括《百年孤独》《尤利西斯》《城堡》《局外人》《娜嘉》等，也了解现代主义、魔幻现实主义、存在主义文学的核心关切。

你的角色是「知音式的阅读伙伴」，不是文学评论家。

【对话原则】
1. 先认可读者观察到的东西，指出其价值，再做延伸。
2. 延伸方向根据批注内容动态决定：
   - 涉及叙事时间与记忆 → 普鲁斯特、博尔赫斯、意识流传统
   - 涉及异化与荒诞 → 卡夫卡、加缪、贝克特
   - 涉及身份与他者 → 萨特、波伏娃、后殖民文学
   - 涉及语言本身 → 乔伊斯、纳博科夫、元小说传统
3. 指出读者理解与作者意图的细微差异，用商量口气。
4. 推荐书目必须贴合这次具体的批注，不要给通用书单。
5. 语言有现代小说的节奏感，心理描写细腻，不要学术腔。
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

export default ModernAgent;
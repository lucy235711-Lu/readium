import ClassicAgent from './classic.js';
import ModernAgent from './modern.js';
import ScienceAgent from './science.js';
import PhilosophyAgent from './philosophy.js';

class AgentFactory {
  static createAgent(style = 'classic', config = {}) {
    const provider = config.provider || 'openai';
    const apiKey = config.apiKey;
    const model = config.model;

    switch (style) {
      case 'classic': return new ClassicAgent({ provider, apiKey, model });
      case 'modern': return new ModernAgent({ provider, apiKey, model });
      case 'science': return new ScienceAgent({ provider, apiKey, model });
      case 'philosophy': return new PhilosophyAgent({ provider, apiKey, model });
      default: return new ClassicAgent({ provider, apiKey, model });
    }
  }

  static getAvailableStyles() {
    return [
      { value: 'classic', label: 'Classic Literature', description: '红楼梦/诗经式' },
      { value: 'modern', label: 'Modern Novel', description: '百年孤独式' },
      { value: 'science', label: 'Science Paper', description: '实验报告式' },
      { value: 'philosophy', label: 'Philosophy', description: '思辨论证式' }
    ];
  }

  static getAvailableProviders() {
    return [
      { value: 'openai', label: 'OpenAI GPT' },
      { value: 'anthropic', label: 'Anthropic Claude' }
    ];
  }
}

export default AgentFactory;
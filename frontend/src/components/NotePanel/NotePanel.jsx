import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sparkles, Loader2, BookOpen, ChevronRight, ChevronDown,
  ChevronUp, Send, MessageCircle, Highlighter, X
} from 'lucide-react';
import { chatWithReflection } from '../../services/api';

const STYLE_OPTIONS = [
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'classic', label: 'Classics' },
  { value: 'modern', label: 'Modern' },
  { value: 'science', label: 'Science' },
];

// Single collapsible reflectionn card
function ReflectionCard({ reflectionData, highlight, agentStyle, onConversationUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [conversation, setConversation] = useState(reflectionData.conversation || []);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (expanded) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, expanded]);

  const handleChat = async () => {
    const msg = chatInput.trim();
    if (!msg || isChatting) return;
    setChatInput('');
    setIsChatting(true);

    const userMsg = { role: 'user', content: msg };
    const newConversation = [...conversation, userMsg];
    setConversation(newConversation);

    try {
      const response = await chatWithReflection({
        sourceText: highlight.content,
        userNote: reflectionData.user_note,
        initialReflection: reflectionData.reflection,
        conversation: newConversation,
        style: agentStyle,
      });
      const aiMsg = { role: 'assistant', content: response.reply };
      const finalConversation = [...newConversation, aiMsg];
      setConversation(finalConversation);
      // Persist conversation
      await onConversationUpdate(reflectionData.id, finalConversation);
    } catch {
      const errMsg = { role: 'assistant', content: '连接失败，请稍后再试。' };
      const finalConversation = [...newConversation, errMsg];
      setConversation(finalConversation);
      await onConversationUpdate(reflectionData.id, finalConversation);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-2.5 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
      >
        <div
          className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: highlight.color || '#FFEB3B' }}
        />
        <p className="flex-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
          "{highlight.content}"
        </p>
        <div className="shrink-0 flex items-center gap-1 mt-0.5">
          {conversation.length > 0 && (
            <span className="text-xs text-slate-400">{Math.floor(conversation.length / 2)}</span>
          )}
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* User note */}
          {reflectionData.user_note && (
            <div className="px-3 py-2.5 bg-slate-50 rounded-xl border-l-2 border-slate-300">
              <p className="text-xs text-slate-400 mb-1">Your note</p>
              <p className="text-sm text-slate-600 leading-relaxed">{reflectionData.user_note}</p>
            </div>
          )}

          {/* Reflection */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">Reflection</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {reflectionData.reflection}
            </p>
          </div>

          {/* Recommendations */}
          {reflectionData.recommendations?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs text-teal-500 font-medium">Further reading</span>
              </div>
              <ul className="space-y-2">
                {reflectionData.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs bg-slate-50 rounded-xl px-3 py-2.5">
                    <span className="text-slate-700 font-medium">{rec.title}</span>
                    {rec.author && <span className="text-slate-400 ml-1">· {rec.author}</span>}
                    <p className="text-slate-400 mt-1 leading-relaxed">{rec.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conversation history */}
          {conversation.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">Conversation</span>
              </div>
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'ml-4 bg-slate-900 text-white rounded-br-sm'
                      : 'mr-4 bg-slate-50 text-slate-700 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {isChatting && (
                <div className="mr-4 bg-slate-50 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Chat input */}
          <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200 focus-within:border-slate-400 transition-colors">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Continue the conversation..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none leading-relaxed"
              style={{ maxHeight: '80px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); }
              }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
            />
            <button
              onClick={handleChat}
              disabled={!chatInput.trim() || isChatting}
              className="p-1.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-30 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-300 text-right -mt-2">↵ send · ⇧↵ newline</p>
        </div>
      )}
    </div>
  );
}

export default function NotePanel({
  highlights,
  reflections,
  generatingForHighlightId,
  onClose,
  agentStyle,
  onStyleChange,
  onConversationUpdate,
}) {
  const [width, setWidth] = useState(380);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      setWidth(Math.max(320, Math.min(600, startWidth.current + delta)));
    };
    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Build a map: highlight_id → reflection
  const reflectionMap = {};
  reflections.forEach(r => { reflectionMap[r.highlight_id] = r; });

  console.log('all reflections:', reflections);
  console.log('current agentStyle:', agentStyle);
  console.log('reflectionMap after filter:', reflectionMap);

  // Only show highlights that have a reflection, plus one being generated
  const highlightsWithReflections = highlights.filter(
    h => reflectionMap[h.id] || h.id === generatingForHighlightId
  );

  const isEmpty = highlightsWithReflections.length === 0 && !generatingForHighlightId;

  return (
    <div
      className="relative flex h-full bg-white border-l border-slate-100 flex-col"
      style={{
        width,
        minWidth: 320,
        maxWidth: 600,
        transition: isResizing.current ? 'none' : 'width 0.15s cubic-bezier(0.4,0,0.2,1)'
      }}
    >
      {/* Drag handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize z-10 group hover:bg-slate-200 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-slate-200 rounded-full group-hover:bg-slate-400 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onStyleChange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                agentStyle === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-full text-slate-300 hover:text-slate-500 ml-2"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300 px-6 text-center">
            <Highlighter className="w-8 h-8" />
            <p className="text-sm">Highlight text and generate a reflection to get started</p>
          </div>
        ) : (
          <>
            {highlightsWithReflections.map(highlight => {
              const ref = reflectionMap[highlight.id];

              // Currently generating for this highlight
              if (highlight.id === generatingForHighlightId && !ref) {
                return (
                  <div key={highlight.id} className="border-b border-slate-100">
                    <div className="flex items-start gap-2.5 px-4 py-3">
                      <div
                        className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: highlight.color || '#FFEB3B' }}
                      />
                      <p className="flex-1 text-xs text-slate-400 line-clamp-2 leading-relaxed italic">
                        "{highlight.content}"
                      </p>
                    </div>
                    <div className="flex items-center gap-2 px-4 pb-3 text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      <span className="text-xs">Generating reflection...</span>
                    </div>
                  </div>
                );
              }

              if (!ref) return null;

              return (
                <ReflectionCard
                  key={highlight.id}
                  highlight={highlight}
                  reflectionData={ref}
                  agentStyle={agentStyle}
                  onConversationUpdate={onConversationUpdate}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
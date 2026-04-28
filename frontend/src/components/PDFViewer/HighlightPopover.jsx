import { useState, useEffect, useRef } from 'react';
import { Highlighter, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { HIGHLIGHT_COLORS } from './PDFViewer';

export default function HighlightPopover({
  position,
  selectedText,
  onClose,
  onHighlightAndReflect,
  onHighlightOnly,
}) {
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].color);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const popoverRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (showNoteInput) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [showNoteInput]);

  const handleReflect = () => {
    onHighlightAndReflect(selectedColor, noteContent.trim() || '');
    onClose();
  };

  const handleHighlightOnly = () => {
    onHighlightOnly(selectedColor);
    onClose();
  };

  if (!position) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, calc(-100% - 14px))',
        minWidth: '300px',
        maxWidth: '360px',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Selected text preview */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <p className="text-xs text-slate-400 mb-1 tracking-wide uppercase">Selected</p>
        <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed font-medium">
          "{selectedText}"
        </p>
      </div>

      {/* Color row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <Highlighter className="w-4 h-4 text-slate-300 shrink-0" />
        <div className="flex items-center gap-2 flex-1">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelectedColor(c.color)}
              className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                selectedColor === c.color
                  ? 'border-slate-600 scale-110 shadow-sm'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: c.color }}
              title={c.name}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-full text-slate-300 hover:text-slate-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Optional note input */}
      <div className="px-4 py-3 border-b border-slate-100">
        <button
          onClick={() => setShowNoteInput(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {showNoteInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Add your thoughts first (optional)
        </button>

        {showNoteInput && (
          <div className="mt-2">
            <textarea
              ref={textareaRef}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="写下你的想法，AI 会围绕它展开..."
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 text-slate-700 placeholder-slate-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReflect();
              }}
            />
            <p className="text-xs text-slate-300 text-right mt-1">⌘↵ generate</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <button
          onClick={handleReflect}
          className="w-full py-2.5 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Sparkles className="w-4 h-4" />
          Highlight + Generate Reflection
        </button>
        <button
          onClick={handleHighlightOnly}
          className="w-full py-2 border border-slate-200 text-slate-500 text-xs rounded-xl hover:bg-slate-50 transition-colors"
        >
          Just highlight, no reflection
        </button>
      </div>

      {/* Arrow */}
      <div className="absolute left-1/2 -bottom-[5px] -translate-x-1/2 rotate-45 w-2.5 h-2.5 bg-white border-r border-b border-slate-100" />
    </div>
  );
}
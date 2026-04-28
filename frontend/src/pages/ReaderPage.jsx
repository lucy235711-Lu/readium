import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import useBookStore from '../stores/useBookStore';
import PDFViewer from '../components/PDFViewer/PDFViewer';
import NotePanel from '../components/NotePanel/NotePanel';
import HighlightPopover from '../components/PDFViewer/HighlightPopover';
import { generateReflection } from '../services/api';

export default function ReaderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const fileUrlRef = useRef(null);

  const {
    currentBook, highlights, reflections, loading,
    currentPage, zoom,
    fetchBook, getFileUrl, createHighlight, createReflection, updateConversation,
    setCurrentPage, setZoom, updateProgress, setTotalPages,
  } = useBookStore();

  const [fileUrl, setFileUrl] = useState(null);
  const [popover, setPopover] = useState(null);
  const [scrollToHighlight, setScrollToHighlight] = useState(null);
  const [generatingForHighlightId, setGeneratingForHighlightId] = useState(null);
  const [agentStyle, setAgentStyle] = useState(
    () => localStorage.getItem('agentStyle') || 'philosophy'
  );

  useEffect(() => { fetchBook(bookId); }, [bookId]);

  useEffect(() => {
    if (!currentBook) return;
    getFileUrl(bookId).then(url => {
      if (url) {
        if (fileUrlRef.current && fileUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(fileUrlRef.current);
        }
        fileUrlRef.current = url;
        setFileUrl(url);
      }
    });
  }, [currentBook, bookId]);

  useEffect(() => {
    const timer = setTimeout(() => updateProgress(), 1000);
    return () => clearTimeout(timer);
  }, [currentPage, zoom]);

  useEffect(() => {
    localStorage.setItem('agentStyle', agentStyle);
  }, [agentStyle]);

  const handleTextSelect = useCallback((text, data) => {
    setPopover({
      position: { x: data.clientX, y: data.clientY },
      text,
      rects: data.rects,
      contextBefore: data.contextBefore || '',
      contextAfter: data.contextAfter || '',
    });
  }, []);

  const handleHighlightAndReflect = useCallback(async (color, userNote) => {
    if (!popover?.text || !popover?.rects) return;

    let highlight = null;
    try {
      const position = JSON.stringify({ rects: popover.rects });
      highlight = await createHighlight(bookId, currentPage, popover.text, position, color);
    } catch (err) {
      console.error('Failed to save highlight:', err);
      return;
    }

    const capturedPopover = { ...popover };
    setGeneratingForHighlightId(highlight.id);
    setPopover(null);

    try {
      const response = await generateReflection({
        sourceText: capturedPopover.text,
        contextBefore: capturedPopover.contextBefore,
        contextAfter: capturedPopover.contextAfter,
        userNote,
        style: agentStyle,
        provider: 'openai',
        highlightId: highlight.id,
        bookId,
        bookTitle: currentBook.title,
      });

      await createReflection({
        highlightId: highlight.id,
        bookId,
        agentStyle,
        userNote,
        reflection: response.reflection,
        recommendations: response.recommendations,
      });
    } catch (err) {
      console.error('Reflection failed:', err);
      await createReflection({
        highlightId: highlight.id,
        bookId,
        agentStyle,
        userNote,
        reflection: '生成失败，请检查 API 连接后重试。',
        recommendations: [],
      });
    } finally {
      setGeneratingForHighlightId(null);
    }
  }, [popover, currentBook, currentPage, bookId, createHighlight, createReflection, agentStyle]);

  const handleHighlightOnly = useCallback(async (color) => {
    if (!popover?.text || !popover?.rects) return;
    const position = JSON.stringify({ rects: popover.rects });
    await createHighlight(bookId, currentPage, popover.text, position, color);
    setPopover(null);
  }, [popover, bookId, currentPage, createHighlight]);

  const handleJumpToSource = useCallback((highlight) => {
    try {
      const position = typeof highlight.position === 'string'
        ? JSON.parse(highlight.position)
        : highlight.position;
      setScrollToHighlight({ ...highlight, rects: position.rects });
    } catch {
      setCurrentPage(highlight.page_number);
    }
  }, [setCurrentPage]);

  const handleConversationUpdate = useCallback(async (reflectionId, conversation) => {
    await updateConversation(reflectionId, conversation);
  }, [updateConversation]);

  if (loading || !currentBook) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b bg-white flex items-center px-4 gap-4 shrink-0 shadow-sm">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-medium truncate text-slate-800">{currentBook.title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">Right-click selected text to reflect</span>
          <button onClick={() => supabase.auth.signOut()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {fileUrl ? (
            <PDFViewer
              fileUrl={fileUrl}
              initialPage={currentPage}
              initialZoom={zoom}
              onPageChange={setCurrentPage}
              onZoomChange={setZoom}
              onTextSelect={handleTextSelect}
              highlights={highlights}
              onHighlightClick={handleJumpToSource}
              scrollToHighlight={scrollToHighlight}
              onDocumentLoadSuccess={(numPages) => setTotalPages(numPages)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            </div>
          )}
        </div>

        <NotePanel
          highlights={highlights}
          reflections={reflections}
          generatingForHighlightId={generatingForHighlightId}
          agentStyle={agentStyle}
          onStyleChange={setAgentStyle}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>

      {popover && (
        <HighlightPopover
          position={popover.position}
          selectedText={popover.text}
          onClose={() => setPopover(null)}
          onHighlightAndReflect={handleHighlightAndReflect}
          onHighlightOnly={handleHighlightOnly}
        />
      )}
    </div>
  );
}

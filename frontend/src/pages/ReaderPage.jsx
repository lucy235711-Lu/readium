import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
  const [noFile, setNoFile] = useState(false);
  const [popover, setPopover] = useState(null);
  const [scrollToHighlight, setScrollToHighlight] = useState(null);
  const [generatingForHighlightId, setGeneratingForHighlightId] = useState(null);
  const [agentStyle, setAgentStyle] = useState(
    () => localStorage.getItem('agentStyle') || 'philosophy'
  );

  useEffect(() => {
    fetchBook(bookId);
  }, [bookId, fetchBook]);

  useEffect(() => {
    if (!currentBook) return;
    const url = getFileUrl(bookId);
    if (url) {
      fileUrlRef.current = url;
      setFileUrl(url);
      setNoFile(false);
    } else {
      setNoFile(true);
    }
    return () => {
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
        fileUrlRef.current = null;
      }
    };
  }, [currentBook, bookId, getFileUrl]);

  useEffect(() => {
    const timer = setTimeout(() => updateProgress(), 1000);
    return () => clearTimeout(timer);
  }, [currentPage, zoom, updateProgress]);

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
      highlight = createHighlight(bookId, currentPage, popover.text, position, color);
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

      createReflection({
        highlightId: highlight.id,
        bookId,
        agentStyle,
        userNote,
        reflection: response.reflection,
        recommendations: response.recommendations,
      });
    } catch (err) {
      console.error('Reflection failed:', err);
      createReflection({
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

  const handleHighlightOnly = useCallback((color) => {
    if (!popover?.text || !popover?.rects) return;
    const position = JSON.stringify({ rects: popover.rects });
    createHighlight(bookId, currentPage, popover.text, position, color);
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

  const handleConversationUpdate = useCallback((reflectionId, conversation) => {
    updateConversation(reflectionId, conversation);
  }, [updateConversation]);

  // Loading state
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

  // No file selected — ask user to pick the file
  if (noFile) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <p className="text-slate-700 font-medium mb-2">{currentBook.title}</p>
          <p className="text-slate-500 text-sm mb-6">
            PDF files aren't stored on the server. Please select the file from your device to continue reading.
          </p>
          <label style={{ cursor: 'pointer' }}>
            <div style={{
              padding: '12px 24px', background: '#63452f', color: '#fff',
              borderRadius: '12px', fontSize: '14px', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}>
              Select PDF file
            </div>
            <input type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                useBookStore.getState().storeFile(bookId, file);
                const url = URL.createObjectURL(file);
                fileUrlRef.current = url;
                setFileUrl(url);
                setNoFile(false);
              }}
            />
          </label>
          <br /><br />
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#8a8278', cursor: 'pointer', fontSize: '13px' }}>
            ← Back to library
          </button>
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
        <div className="ml-auto text-xs text-slate-400">
          Right-click selected text to reflect
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#FFEB3B' },
  { name: 'Green', color: '#4CAF50' },
  { name: 'Blue', color: '#2196F3' },
  { name: 'Pink', color: '#E91E63' },
  { name: 'Orange', color: '#FF9800' }
];

const PDF_PAGE_WIDTH = 612;

export default function PDFViewer({
  fileUrl,
  initialPage = 1,
  initialZoom = 1.0,
  onPageChange,
  onZoomChange,
  onTextSelect,
  highlights = [],
  onHighlightClick,
  scrollToHighlight,
  className = ''
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(initialZoom);
  const [containerWidth, setContainerWidth] = useState(800);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectionData, setSelectionData] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null);

  const containerRef = useRef(null);
  const pageRef = useRef(null);

  const actualScale = scale * (containerWidth / PDF_PAGE_WIDTH);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (err) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF');
    setLoading(false);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      const width = containerRef.current.clientWidth - 64;
      setContainerWidth(Math.max(400, width));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // External trigger to scroll to highlight
  useEffect(() => {
    if (!scrollToHighlight) return;
    setPageNumber(scrollToHighlight.page_number);
    onPageChange?.(scrollToHighlight.page_number);
    setTimeout(() => {
      if (!pageRef.current || !scrollToHighlight.rects?.length) return;
      const rect = scrollToHighlight.rects[0];
      const top = rect.y * actualScale;
      containerRef.current?.scrollTo({ top: top - 100, behavior: 'smooth' });
    }, 300);
  }, [scrollToHighlight]);

  const goToPrevPage = useCallback(() => {
    if (pageNumber <= 1 || isFlipping) return;
    setIsFlipping(true); setFlipDirection('right');
    setTimeout(() => {
      const p = pageNumber - 1; setPageNumber(p); onPageChange?.(p);
      setTimeout(() => { setIsFlipping(false); setFlipDirection(null); }, 200);
    }, 200);
  }, [pageNumber, isFlipping, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (pageNumber >= numPages || isFlipping) return;
    setIsFlipping(true); setFlipDirection('left');
    setTimeout(() => {
      const p = pageNumber + 1; setPageNumber(p); onPageChange?.(p);
      setTimeout(() => { setIsFlipping(false); setFlipDirection(null); }, 200);
    }, 200);
  }, [pageNumber, numPages, isFlipping, onPageChange]);

  const handleZoomChange = (newScale) => {
    const clamped = Math.max(0.5, Math.min(2.0, newScale));
    setScale(clamped); onZoomChange?.(clamped);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPrevPage();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToNextPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString()?.trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    if (!range) return;

    const rects = [];
    try {
      const clientRects = Array.from(range.getClientRects());
      const pageRect = pageRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

      for (const r of clientRects) {
        if (r.width < 1 || r.height < 1) continue;
        rects.push({
          x: (r.left - pageRect.left) / actualScale,
          y: (r.top - pageRect.top) / actualScale,
          width: r.width / actualScale,
          height: r.height / actualScale,
        });
      }
    } catch (e) {
      console.warn('rect error', e);
    }

    if (rects.length > 0) {
      setSelectionData({ text: selectedText, rects });
    }
  };

  const handleContextMenu = (e) => {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();
    if (!text && !selectionData) return;

    e.preventDefault();
    const data = selectionData || { text, rects: [] };
    onTextSelect?.(data.text, {
      rects: data.rects,
      clientX: e.clientX,
      clientY: e.clientY,
      contextBefore: '',
      contextAfter: '',
    });
    selection?.removeAllRanges();
    setSelectionData(null);
  };

  useEffect(() => { setSelectionData(null); }, [pageNumber]);

  // FIXED: render highlights using actualScale (symmetric with storage)
  const renderHighlights = () => {
    if (!highlights?.length) return null;
    return highlights
      .filter(h => h.page_number === pageNumber)
      .map(highlight => {
        try {
          const position = typeof highlight.position === 'string'
            ? JSON.parse(highlight.position)
            : highlight.position;
          const rects = position.rects || [];

          return rects.map((rect, index) => {
            const left = rect.x * actualScale;
            const top = rect.y * actualScale;
            const width = rect.width * actualScale;
            const height = rect.height * actualScale;
            if (width <= 0 || height <= 0) return null;

            const color = highlight.color || '#FFEB3B';
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);

            return (
              <div
                key={`${highlight.id}-${index}`}
                className="absolute cursor-pointer transition-opacity hover:opacity-70"
                style={{
                  left: `${left}px`, top: `${top}px`,
                  width: `${width}px`, height: `${height}px`,
                  backgroundColor: `rgba(${r},${g},${b},0.35)`,
                  borderRadius: '2px', zIndex: 10,
                  mixBlendMode: 'multiply',
                }}
                onClick={(e) => { e.stopPropagation(); onHighlightClick?.(highlight); }}
                title={highlight.content}
              />
            );
          });
        } catch { return null; }
      });
  };

  const getAnimationClass = () => {
    if (!isFlipping || !flipDirection) return '';
    return flipDirection === 'left' ? 'animate-slide-left' : 'animate-slide-right';
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-slate-100 ${className}`}>
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); }} className="text-sm text-slate-600 hover:text-slate-800">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-100 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={goToPrevPage} disabled={pageNumber <= 1 || isFlipping}
            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <input type="number" value={pageNumber}
              onChange={(e) => { const p = Math.max(1, Math.min(parseInt(e.target.value)||1, numPages||1)); setPageNumber(p); onPageChange?.(p); }}
              className="w-14 px-2 py-1 border rounded text-center" min={1} max={numPages||1} />
            <span className="text-slate-500">/ {numPages || '-'}</span>
          </div>
          <button onClick={goToNextPage} disabled={pageNumber >= numPages || isFlipping}
            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleZoomChange(scale - 0.1)} disabled={scale <= 0.5} className="p-2 rounded hover:bg-slate-100 disabled:opacity-50">
            <ZoomOut className="w-5 h-5" />
          </button>
          <input type="range" min="0.5" max="2" step="0.1" value={scale}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))} className="w-32" />
          <button onClick={() => handleZoomChange(scale + 0.1)} disabled={scale >= 2} className="p-2 rounded hover:bg-slate-100 disabled:opacity-50">
            <ZoomIn className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-500 w-12">{Math.round(scale * 100)}%</span>
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-8 flex justify-center relative"
        onContextMenu={handleContextMenu}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}
        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={null}>
          <div ref={pageRef} className={`relative ${getAnimationClass()}`}>
            <Page
              pageNumber={pageNumber}
              scale={actualScale}
              onMouseUp={handleMouseUp}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
            {renderHighlights()}
          </div>
        </Document>
      </div>
    </div>
  );
}

export { HIGHLIGHT_COLORS, PDF_PAGE_WIDTH };
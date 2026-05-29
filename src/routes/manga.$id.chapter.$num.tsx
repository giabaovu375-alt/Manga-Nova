// src/routes/manga.$id.chapter.$num.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Home,
  List,
  X,
  BookOpen,
  Eye,
  ArrowUp,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/manga/$id/chapter/$num")({
  component: SimpleReader,
});

async function fetchChapterList(mangaId: string) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, chapter_number, pages, title, views")
    .eq("manga_id", mangaId)
    .order("chapter_number");
  if (error) throw error;
  return data ?? [];
}

function SimpleReader() {
  const { id, num } = Route.useParams();
  const navigate = useNavigate();
  const chapterNum = Number(num);

  const [showUI, setShowUI] = useState(true);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapter-list", id],
    queryFn: () => fetchChapterList(id),
    staleTime: 1000 * 60 * 60,
  });

  const idx = chapters.findIndex((c) => c.chapter_number === chapterNum);
  const current = chapters[idx] ?? null;
  const prev = chapters[idx - 1] ?? null;
  const next = chapters[idx + 1] ?? null;
  const pages: string[] = current?.pages ?? [];

  const go = useCallback(
    (target?: number) => {
      if (target == null) return;
      navigate({
        to: "/manga/$id/chapter/$num",
        params: { id, num: String(target) },
      });
    },
    [id, navigate]
  );

  // Increment view
  useEffect(() => {
    if (!current?.id) return;
    const key = `viewed_${current.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void supabase.rpc("increment_chapter_views", { _chapter_id: current.id });
  }, [current?.id]);

  // Reset loaded pages on chapter change
  useEffect(() => {
    setLoadedPages(new Set());
    window.scrollTo({ top: 0 });
  }, [num]);

  // Auto-hide UI on scroll
  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUI(false), 3500);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setShowScrollTop(currentY > 800);
      if (currentY < lastScrollY.current) {
        resetHideTimer();
      }
      lastScrollY.current = currentY;
    };
    const handleMouseMove = () => resetHideTimer();
    const handleTouchStart = () => resetHideTimer();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    resetHideTimer();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleTouchStart);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [resetHideTimer]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev) go(prev.chapter_number);
      if (e.key === "ArrowRight" && next) go(next.chapter_number);
      if (e.key === "Escape") setShowChapterList(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next, go]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Loader2
            style={{
              width: 30,
              height: 30,
              color: "#e8b84b",
              animation: "spin 1s linear infinite",
            }}
          />
          <span
            style={{
              color: "#555",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Đang tải...
          </span>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#111",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <BookOpen style={{ width: 44, height: 44, color: "#2a2a2a" }} />
        <p style={{ color: "#555", fontSize: 14, margin: 0 }}>
          Không tìm thấy chương này.
        </p>
        <Link
          to="/manga/$id"
          params={{ id }}
          style={{
            color: "#e8b84b",
            fontSize: 13,
            textDecoration: "none",
            border: "1px solid rgba(232,184,75,0.3)",
            padding: "8px 22px",
            borderRadius: 8,
          }}
        >
          ← Quay lại
        </Link>
      </div>
    );
  }

  const uiOpacity = showUI ? 1 : 0;
  const uiPointer = showUI ? "all" : "none";

  return (
    <div className="reader-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }

        .reader-root {
          font-family: 'Be Vietnam Pro', sans-serif;
          background: #111;
          min-height: 100vh;
          color: #e8e6e1;
        }

        /* ─── PROGRESS BAR ─── */
        .progress-wrap {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 3px;
          z-index: 100;
          background: rgba(255,255,255,0.04);
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #c9952a, #e8b84b, #f5d170);
          transition: width 0.15s ease;
          box-shadow: 0 0 8px rgba(232,184,75,0.6);
        }

        /* ─── TOP BAR ─── */
        .top-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          height: 56px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          background: linear-gradient(
            to bottom,
            rgba(10,10,10,0.98) 0%,
            rgba(10,10,10,0.7) 70%,
            transparent 100%
          );
          transition: opacity 0.35s ease;
        }

        .top-bar-title {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          font-weight: 600;
          color: #ddd;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .top-bar-sub {
          font-size: 11px;
          font-weight: 400;
          color: #555;
          margin-left: 8px;
        }

        .icon-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: #aaa;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          text-decoration: none;
        }
        .icon-btn:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }
        .icon-btn:active {
          transform: scale(0.93);
        }

        /* ─── PAGES ─── */
        .pages-container {
          max-width: 720px;
          margin: 0 auto;
          padding-top: 56px;       /* clearance for top bar */
          padding-bottom: 88px;    /* clearance for bottom bar */
        }

        /* Gap between pages — key for readability */
        .page-wrapper {
          position: relative;
          width: 100%;
          margin-bottom: 6px;      /* subtle gap between pages */
        }
        /* Larger gap every ~5 pages acts as a visual "breath" */
        .page-wrapper:nth-child(5n) {
          margin-bottom: 14px;
        }

        .page-img {
          width: 100%;
          height: auto;
          display: block;
          transition: opacity 0.35s ease;
          user-select: none;
          -webkit-user-drag: none;
        }
        .page-img.loading {
          opacity: 0;
        }
        .page-img.loaded {
          opacity: 1;
        }

        /* Skeleton shimmer while loading */
        .page-skeleton {
          width: 100%;
          min-height: 480px;
          background: linear-gradient(
            90deg,
            #1a1a1a 0%,
            #222 30%,
            #1e1e1e 50%,
            #222 70%,
            #1a1a1a 100%
          );
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
        }
        .page-skeleton.hidden {
          display: none;
        }

        /* Page number badge — like MangaDex */
        .page-num-badge {
          position: absolute;
          bottom: 8px;
          right: 10px;
          background: rgba(0,0,0,0.65);
          color: #666;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 2px 7px;
          border-radius: 4px;
          pointer-events: none;
          user-select: none;
          backdrop-filter: blur(4px);
        }

        /* ─── END CARD ─── */
        .end-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 52px 20px 40px;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.05);
          margin-top: 10px;
        }
        .end-card-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(232,184,75,0.1);
          border: 1px solid rgba(232,184,75,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e8b84b;
        }
        .end-card-title {
          font-size: 16px;
          font-weight: 700;
          color: #e8e6e1;
          letter-spacing: 0.01em;
        }
        .end-card-sub {
          font-size: 13px;
          color: #555;
          line-height: 1.5;
        }
        .end-card-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 4px;
        }

        .end-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 24px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          text-decoration: none;
          letter-spacing: 0.02em;
          font-family: 'Be Vietnam Pro', sans-serif;
        }
        .end-btn-primary {
          background: linear-gradient(135deg, #e8b84b 0%, #c9952a 100%);
          color: #0f0f0f;
          box-shadow: 0 4px 18px rgba(232,184,75,0.25);
        }
        .end-btn-primary:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(232,184,75,0.35);
        }
        .end-btn-secondary {
          background: rgba(255,255,255,0.06);
          color: #999;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .end-btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          color: #ddd;
        }

        /* ─── BOTTOM BAR ─── */
        .bottom-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          /* Extra padding for iOS home indicator */
          padding-bottom: max(10px, env(safe-area-inset-bottom, 10px));
          background: linear-gradient(
            to top,
            rgba(10,10,10,0.99) 60%,
            rgba(10,10,10,0.7) 85%,
            transparent 100%
          );
          transition: opacity 0.35s ease;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 9px 16px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          letter-spacing: 0.03em;
          font-family: 'Be Vietnam Pro', sans-serif;
          white-space: nowrap;
        }
        .nav-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .nav-btn-prev {
          background: rgba(255,255,255,0.06);
          color: #bbb;
          border: 1px solid rgba(255,255,255,0.08);
          min-width: 0;
        }
        .nav-btn-prev:hover:not(:disabled) {
          background: rgba(255,255,255,0.11);
          color: #fff;
        }
        .nav-btn-prev:disabled {
          opacity: 0.22;
          cursor: not-allowed;
        }

        .nav-btn-next {
          background: linear-gradient(135deg, #e8b84b 0%, #c9952a 100%);
          color: #0f0f0f;
          min-width: 0;
          box-shadow: 0 2px 12px rgba(232,184,75,0.3);
        }
        .nav-btn-next:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(232,184,75,0.4);
        }
        .nav-btn-next:disabled {
          opacity: 0.28;
          cursor: not-allowed;
          transform: none;
          filter: none;
          box-shadow: none;
        }

        .center-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          min-width: 0;
          overflow: hidden;
        }
        .center-info-ch {
          font-size: 13px;
          font-weight: 700;
          color: #e8b84b;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .center-info-pages {
          font-size: 10px;
          color: #444;
          letter-spacing: 0.06em;
        }

        /* ─── SCROLL TO TOP ─── */
        .scroll-top-btn {
          position: fixed;
          bottom: 80px;
          right: 14px;
          z-index: 45;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(18,18,18,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.2s ease;
        }
        .scroll-top-btn:hover {
          color: #e8b84b;
          border-color: rgba(232,184,75,0.4);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .scroll-top-btn:active { transform: scale(0.92); }

        /* ─── CHAPTER DRAWER ─── */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 70;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(6px);
          animation: fadeIn 0.2s ease;
        }
        .drawer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 80;
          background: #161616;
          border-top: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px 18px 0 0;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1);
          /* Safe area for iOS */
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        /* Drag handle */
        .drawer-handle {
          width: 40px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.12);
          margin: 12px auto 0;
          flex-shrink: 0;
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
        }
        .drawer-title {
          font-size: 14px;
          font-weight: 700;
          color: #ddd;
          letter-spacing: 0.02em;
        }
        .drawer-count {
          font-size: 11px;
          color: #555;
          font-weight: 400;
          margin-left: 8px;
        }

        .drawer-list {
          overflow-y: auto;
          padding: 6px 10px 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(232,184,75,0.25) transparent;
          overscroll-behavior: contain;
        }
        .drawer-list::-webkit-scrollbar { width: 3px; }
        .drawer-list::-webkit-scrollbar-thumb {
          background: rgba(232,184,75,0.25);
          border-radius: 3px;
        }

        .drawer-item {
          display: flex;
          align-items: center;
          padding: 10px 10px;
          border-radius: 9px;
          cursor: pointer;
          color: #888;
          font-size: 13px;
          transition: background 0.12s, color 0.12s;
          gap: 10px;
        }
        .drawer-item:hover {
          background: rgba(255,255,255,0.05);
          color: #ddd;
        }
        .drawer-item.active {
          background: rgba(232,184,75,0.09);
          color: #e8b84b;
        }
        .drawer-item.active .drawer-item-num {
          color: #e8b84b;
        }
        .drawer-item-num {
          font-weight: 700;
          font-size: 12px;
          min-width: 58px;
          color: #666;
          letter-spacing: 0.02em;
        }
        .drawer-item-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
        }
        .drawer-item-right {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #3a3a3a;
          flex-shrink: 0;
        }
        .drawer-item-active-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #e8b84b;
          flex-shrink: 0;
        }

        /* ─── RESPONSIVE ─── */

        /* Mobile: full-width, no side padding */
        @media (max-width: 600px) {
          .pages-container {
            max-width: 100%;
            padding-top: 52px;
            padding-bottom: 80px;
          }
          .page-wrapper {
            margin-bottom: 4px;
          }
          .page-wrapper:nth-child(5n) {
            margin-bottom: 10px;
          }
          .top-bar {
            height: 52px;
            padding: 0 10px;
            gap: 8px;
          }
          .nav-btn {
            padding: 9px 13px;
            font-size: 12px;
          }
          .scroll-top-btn {
            bottom: 74px;
            right: 10px;
            width: 38px;
            height: 38px;
          }
          .end-card {
            padding: 44px 16px 32px;
          }
        }

        /* Tablet: slightly wider center strip */
        @media (min-width: 601px) and (max-width: 1024px) {
          .pages-container {
            max-width: 680px;
          }
        }

        /* Desktop: wider strip and slightly bigger gaps */
        @media (min-width: 1025px) {
          .pages-container {
            max-width: 760px;
          }
          .page-wrapper {
            margin-bottom: 8px;
          }
          .page-wrapper:nth-child(5n) {
            margin-bottom: 18px;
          }
          .drawer {
            max-width: 480px;
            left: 50%;
            right: auto;
            transform: translateX(-50%);
            border-radius: 18px 18px 0 0;
          }
        }
      `}</style>

      {/* Progress bar */}
      <ReadingProgress pages={pages} />

      {/* ── Top Bar ── */}
      <div
        className="top-bar"
        style={{ opacity: uiOpacity, pointerEvents: uiPointer as any }}
      >
        <Link to="/manga/$id" params={{ id }} className="icon-btn">
          <ChevronLeft size={18} />
        </Link>
        <Link to="/" className="icon-btn">
          <Home size={15} />
        </Link>
        <div className="top-bar-title">
          {current.title
            ? `Ch.${chapterNum}: ${current.title}`
            : `Chương ${chapterNum}`}
          <span className="top-bar-sub">
            {idx + 1} / {chapters.length}
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={() => setShowChapterList(true)}
          style={{ border: "none" }}
          aria-label="Danh sách chương"
        >
          <List size={16} />
        </button>
      </div>

      {/* ── Pages ── */}
      <div className="pages-container">
        {pages.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 0",
              color: "#333",
              fontSize: 14,
            }}
          >
            Chương này chưa có trang nào.
          </div>
        ) : (
          <>
            {pages.map((src, i) => (
              <PageImage
                key={`${num}-${i}`}
                src={src}
                index={i}
                total={pages.length}
                onLoad={() => setLoadedPages((prev) => new Set(prev).add(i))}
                eager={i < 4}
              />
            ))}

            {/* End of chapter */}
            <div className="end-card">
              <div className="end-card-icon">
                <CheckCircle2 size={22} />
              </div>
              <p className="end-card-title">Hết chương {chapterNum}</p>

              {next ? (
                <>
                  <p className="end-card-sub">Chương tiếp theo đang chờ bạn</p>
                  <div className="end-card-actions">
                    <button
                      className="end-btn end-btn-primary"
                      onClick={() => go(next.chapter_number)}
                    >
                      <ChevronRight size={15} />
                      Chương {next.chapter_number}
                      {next.title ? `: ${next.title}` : ""}
                    </button>
                    <Link
                      to="/manga/$id"
                      params={{ id }}
                      className="end-btn end-btn-secondary"
                      style={{ textDecoration: "none" }}
                    >
                      <List size={14} />
                      Tất cả chương
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="end-card-sub">
                    Bạn đã đọc đến chương mới nhất 🎉
                  </p>
                  <div className="end-card-actions">
                    <Link
                      to="/manga/$id"
                      params={{ id }}
                      className="end-btn end-btn-primary"
                      style={{ textDecoration: "none" }}
                    >
                      ← Quay lại danh sách
                    </Link>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Bottom Bar ── */}
      <div
        className="bottom-bar"
        style={{ opacity: uiOpacity, pointerEvents: uiPointer as any }}
      >
        <button
          className="nav-btn nav-btn-prev"
          onClick={() => go(prev?.chapter_number)}
          disabled={!prev}
        >
          <ChevronLeft size={14} />
          Ch.{prev?.chapter_number ?? "–"}
        </button>

        <div className="center-info">
          <span className="center-info-ch">Chương {chapterNum}</span>
          <span className="center-info-pages">{pages.length} trang</span>
        </div>

        <button
          className="nav-btn nav-btn-next"
          onClick={() => go(next?.chapter_number)}
          disabled={!next}
        >
          Ch.{next?.chapter_number ?? "–"}
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button
          className="scroll-top-btn"
          style={{ opacity: uiOpacity, pointerEvents: uiPointer as any }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Lên đầu trang"
        >
          <ArrowUp size={16} />
        </button>
      )}

      {/* ── Chapter List Drawer ── */}
      {showChapterList && (
        <>
          <div
            className="drawer-overlay"
            onClick={() => setShowChapterList(false)}
          />
          <div className="drawer">
            <div className="drawer-handle" />
            <div className="drawer-header">
              <span className="drawer-title">
                Danh sách chương
                <span className="drawer-count">{chapters.length} chương</span>
              </span>
              <button
                className="icon-btn"
                onClick={() => setShowChapterList(false)}
                style={{ border: "none", background: "transparent" }}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>
            <div className="drawer-list">
              {chapters.map((c) => {
                const isActive = c.chapter_number === chapterNum;
                return (
                  <div
                    key={c.id}
                    className={`drawer-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setShowChapterList(false);
                      go(c.chapter_number);
                    }}
                  >
                    <span className="drawer-item-num">Ch.{c.chapter_number}</span>
                    <span className="drawer-item-title">
                      {c.title || `Chương ${c.chapter_number}`}
                    </span>
                    <span className="drawer-item-right">
                      {isActive ? (
                        <span className="drawer-item-active-dot" />
                      ) : (
                        <>
                          <Eye size={10} />
                          {(c.views ?? 0).toLocaleString()}
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──

function ReadingProgress({ pages }: { pages: string[] }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pages]);

  return (
    <div className="progress-wrap">
      <div className="progress-fill" style={{ width: `${progress}%` }} />
    </div>
  );
}

function PageImage({
  src,
  index,
  total,
  onLoad,
  eager,
}: {
  src: string;
  index: number;
  total: number;
  onLoad: () => void;
  eager: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="page-wrapper">
      {/* Shimmer skeleton */}
      <div className={`page-skeleton ${loaded ? "hidden" : ""}`} />

      <img
        src={src}
        alt={`Trang ${index + 1}`}
        className={`page-img ${loaded ? "loaded" : "loading"}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => {
          setLoaded(true);
          onLoad();
        }}
      />

      {/* Page number badge */}
      <span className="page-num-badge">
        {index + 1} / {total}
      </span>
    </div>
  );
}

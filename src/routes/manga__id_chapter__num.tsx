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
  Settings,
  ArrowUp,
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
    hideTimer.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setShowScrollTop(currentY > 600);
      // Show UI when scrolling up
      if (currentY < lastScrollY.current) {
        resetHideTimer();
      }
      lastScrollY.current = currentY;
    };
    const handleMouseMove = () => resetHideTimer();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);
    resetHideTimer();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
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

  const go = useCallback((target?: number) => {
    if (target == null) return;
    navigate({
      to: "/manga/$id/chapter/$num",
      params: { id, num: String(target) },
    });
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Loader2 style={{ width: 32, height: 32, color: "#e8b84b", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#555", fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>Đang tải...</span>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4">
        <BookOpen style={{ width: 48, height: 48, color: "#333" }} />
        <p style={{ color: "#555", fontSize: 14 }}>Không tìm thấy chương này.</p>
        <Link
          to="/manga/$id"
          params={{ id }}
          style={{
            color: "#e8b84b",
            fontSize: 13,
            textDecoration: "none",
            border: "1px solid rgba(232,184,75,0.3)",
            padding: "8px 20px",
            borderRadius: 8,
          }}
        >
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const uiOpacity = showUI ? 1 : 0;
  const uiPointer = showUI ? "all" : "none";

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: none; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: none; } }

        .reader-wrap {
          font-family: 'Noto Sans', sans-serif;
        }

        /* ── Top bar ── */
        .top-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 52px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 100%);
          transition: opacity 0.3s ease;
        }

        .top-bar-title {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: #e8e6e1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .top-bar-sub {
          font-size: 12px;
          color: #888;
          font-weight: 400;
          margin-left: 8px;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.08);
          color: #ccc;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          flex-shrink: 0;
        }
        .icon-btn:hover {
          background: rgba(255,255,255,0.13);
          color: #fff;
        }

        /* ── Bottom bar ── */
        .bottom-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px 14px;
          background: linear-gradient(to top, rgba(0,0,0,0.97) 60%, rgba(0,0,0,0) 100%);
          transition: opacity 0.3s ease;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
          letter-spacing: 0.02em;
        }

        .nav-btn-prev {
          background: rgba(255,255,255,0.06);
          color: #ccc;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .nav-btn-prev:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }
        .nav-btn-prev:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .nav-btn-next {
          background: linear-gradient(135deg, #e8b84b, #c9952a);
          color: #0f0f0f;
        }
        .nav-btn-next:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(232,184,75,0.35);
        }
        .nav-btn-next:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          transform: none;
          filter: none;
          box-shadow: none;
        }

        .chapter-info-center {
          flex: 1;
          text-align: center;
        }

        .chapter-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
        }

        .chapter-badge-num {
          font-size: 13px;
          font-weight: 700;
          color: #e8b84b;
          letter-spacing: 0.04em;
        }

        .chapter-badge-total {
          font-size: 10px;
          color: #555;
          letter-spacing: 0.06em;
        }

        /* ── Progress bar ── */
        .progress-bar-wrap {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 2px;
          z-index: 60;
          background: rgba(255,255,255,0.05);
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #e8b84b, #f0c860);
          transition: width 0.1s ease;
        }

        /* ── Chapter list drawer ── */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 70;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease;
        }

        .drawer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 80;
          background: #141414;
          border-top: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px 16px 0 0;
          max-height: 65vh;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.25s cubic-bezier(0.32,0.72,0,1);
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }

        .drawer-title {
          font-size: 14px;
          font-weight: 700;
          color: #e8e6e1;
          letter-spacing: 0.03em;
        }

        .drawer-list {
          overflow-y: auto;
          padding: 8px 12px 20px;
          scrollbar-width: thin;
          scrollbar-color: rgba(232,184,75,0.3) transparent;
        }
        .drawer-list::-webkit-scrollbar { width: 3px; }
        .drawer-list::-webkit-scrollbar-thumb { background: rgba(232,184,75,0.3); border-radius: 3px; }

        .drawer-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 12px;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          color: #999;
          font-size: 13px;
          transition: all 0.12s;
          gap: 8px;
        }
        .drawer-item:hover {
          background: rgba(255,255,255,0.05);
          color: #e8e6e1;
        }
        .drawer-item.active {
          background: rgba(232,184,75,0.08);
          color: #e8b84b;
          border: 1px solid rgba(232,184,75,0.2);
        }

        .drawer-item-num {
          font-weight: 700;
          font-size: 13px;
          min-width: 72px;
        }

        .drawer-item-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .drawer-item-views {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #444;
          flex-shrink: 0;
        }

        /* ── Pages ── */
        .pages-container {
          max-width: 800px;
          margin: 0 auto;
          padding-top: 52px;
          padding-bottom: 80px;
        }

        .page-img {
          width: 100%;
          height: auto;
          display: block;
          transition: opacity 0.3s ease;
        }

        .page-img.loading {
          opacity: 0;
          min-height: 400px;
          background: #161616;
        }

        .page-img.loaded {
          opacity: 1;
        }

        /* ── End chapter card ── */
        .end-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 48px 24px;
          text-align: center;
        }

        .end-card-title {
          font-size: 15px;
          font-weight: 600;
          color: #e8e6e1;
        }

        .end-card-sub {
          font-size: 13px;
          color: #555;
        }

        .end-card-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          background: linear-gradient(135deg, #e8b84b, #c9952a);
          color: #0f0f0f;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          text-decoration: none;
        }
        .end-card-btn:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(232,184,75,0.3);
        }

        .end-card-btn-outline {
          background: transparent;
          color: #888;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .end-card-btn-outline:hover {
          color: #e8e6e1;
          border-color: rgba(255,255,255,0.2);
          filter: none;
          box-shadow: none;
        }

        /* ── Scroll to top ── */
        .scroll-top-btn {
          position: fixed;
          bottom: 80px;
          right: 16px;
          z-index: 40;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(20,20,20,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .scroll-top-btn:hover {
          color: #e8b84b;
          border-color: rgba(232,184,75,0.4);
        }
      `}</style>

      <ReadingProgress pages={pages} />

      <div className="reader-wrap">
        {/* ── Top Bar ── */}
        <div className="top-bar" style={{ opacity: uiOpacity, pointerEvents: uiPointer as any }}>
          <Link to="/manga/$id" params={{ id }} className="icon-btn">
            <ChevronLeft size={18} />
          </Link>
          <Link to="/" className="icon-btn">
            <Home size={16} />
          </Link>
          <div className="top-bar-title">
            {current.title
              ? `Ch.${chapterNum}: ${current.title}`
              : `Chương ${chapterNum}`}
            <span className="top-bar-sub">{idx + 1} / {chapters.length}</span>
          </div>
          <button className="icon-btn" onClick={() => setShowChapterList(true)} style={{ border: "none" }}>
            <List size={16} />
          </button>
        </div>

        {/* ── Pages ── */}
        <div className="pages-container">
          {pages.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "#444", fontSize: 14 }}>
              Chương này chưa có trang nào.
            </div>
          ) : (
            <>
              {pages.map((src, i) => (
                <PageImage
                  key={`${num}-${i}`}
                  src={src}
                  index={i}
                  onLoad={() => setLoadedPages(prev => new Set(prev).add(i))}
                  eager={i < 3}
                />
              ))}

              {/* End of chapter */}
              <div className="end-card">
                <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.08)" }} />
                <p className="end-card-title">Hết chương {chapterNum}</p>
                {next ? (
                  <>
                    <p className="end-card-sub">Chương tiếp theo đang chờ bạn</p>
                    <button className="end-card-btn" onClick={() => go(next.chapter_number)}>
                      <ChevronRight size={16} />
                      Chương {next.chapter_number}
                      {next.title ? `: ${next.title}` : ""}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="end-card-sub">Bạn đã đọc đến chương mới nhất 🎉</p>
                    <Link to="/manga/$id" params={{ id }} className="end-card-btn end-card-btn-outline" style={{ textDecoration: "none" }}>
                      ← Quay lại danh sách
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Bottom Bar ── */}
        <div className="bottom-bar" style={{ opacity: uiOpacity, pointerEvents: uiPointer as any }}>
          <button
            className="nav-btn nav-btn-prev"
            onClick={() => go(prev?.chapter_number)}
            disabled={!prev}
          >
            <ChevronLeft size={15} />
            Ch.{prev?.chapter_number ?? "–"}
          </button>

          <div className="chapter-info-center">
            <div className="chapter-badge">
              <span className="chapter-badge-num">Chương {chapterNum}</span>
              <span className="chapter-badge-total">{pages.length} trang</span>
            </div>
          </div>

          <button
            className="nav-btn nav-btn-next"
            onClick={() => go(next?.chapter_number)}
            disabled={!next}
          >
            Ch.{next?.chapter_number ?? "–"}
            <ChevronRight size={15} />
          </button>
        </div>

        {/* ── Scroll to top ── */}
        {showScrollTop && (
          <button
            className="scroll-top-btn"
            style={{ opacity: uiOpacity, pointerEvents: uiPointer as any }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ArrowUp size={16} />
          </button>
        )}

        {/* ── Chapter List Drawer ── */}
        {showChapterList && (
          <>
            <div className="drawer-overlay" onClick={() => setShowChapterList(false)} />
            <div className="drawer">
              <div className="drawer-header">
                <span className="drawer-title">Danh sách chương</span>
                <button className="icon-btn" onClick={() => setShowChapterList(false)} style={{ border: "none", background: "transparent" }}>
                  <X size={16} />
                </button>
              </div>
              <div className="drawer-list">
                {chapters.map((c) => (
                  <div
                    key={c.id}
                    className={`drawer-item ${c.chapter_number === chapterNum ? "active" : ""}`}
                    onClick={() => {
                      setShowChapterList(false);
                      go(c.chapter_number);
                    }}
                  >
                    <span className="drawer-item-num">Ch.{c.chapter_number}</span>
                    <span className="drawer-item-title">
                      {c.title || `Chương ${c.chapter_number}`}
                    </span>
                    <span className="drawer-item-views">
                      <Eye size={10} />
                      {c.views?.toLocaleString() ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
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
  }, []);

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
    </div>
  );
}

function PageImage({
  src,
  index,
  onLoad,
  eager,
}: {
  src: string;
  index: number;
  onLoad: () => void;
  eager: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={`Trang ${index + 1}`}
      className={`page-img ${loaded ? "loaded" : "loading"}`}
      loading={eager ? "eager" : "lazy"}
      onLoad={() => {
        setLoaded(true);
        onLoad();
      }}
    />
  );
}

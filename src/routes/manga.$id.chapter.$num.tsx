import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manga/$id/chapter/$num")({
  component: Reader,
});

// ---------------------------
// TYPES
// ---------------------------
interface Chapter {
  id: string;
  chapter_number: number;
  pages: string[];
  title: string | null;
}

// ---------------------------
// FETCHERS
// ---------------------------
async function fetchChapterList(mangaId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, chapter_number, pages, title")
    .eq("manga_id", mangaId)
    .order("chapter_number");

  if (error) throw error;
  return (data ?? []).sort((a, b) => a.chapter_number - b.chapter_number);
}

// ---------------------------
// STATE BUILDER (SAFE)
// ---------------------------
function buildChapterState(list: Chapter[], chapterNum: number) {
  const safeList = Array.isArray(list) ? list : [];
  const idx = safeList.findIndex((c) => c.chapter_number === chapterNum);
  const safeIdx = idx >= 0 ? idx : 0;

  return {
    current: safeList[safeIdx] ?? null,
    prev: safeList[safeIdx - 1] ?? null,
    next: safeList[safeIdx + 1] ?? null,
    index: safeIdx,
    found: idx >= 0,
  };
}

// ---------------------------
// MANGA PAGE (MEMO + FADE)
// ---------------------------
const MangaPage = memo(function MangaPage({
  src,
  index,
}: {
  src: string;
  index: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full">
      {!loaded && !error && (
        <div className="w-full aspect-[2/3] bg-[#161616] animate-pulse" />
      )}

      {error ? (
        <div className="w-full aspect-[2/3] flex flex-col items-center justify-center bg-[#161616] text-white/20 gap-2 text-sm">
          <BookOpen className="w-6 h-6 opacity-30" />
          <span>Không tải được trang {index + 1}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={`Trang ${index + 1}`}
          className={`w-full h-auto transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0 absolute inset-0"
          }`}
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
});

// ---------------------------
// CHAPTER SELECTOR DROPDOWN
// ---------------------------
function ChapterSelector({
  chapters,
  currentNum,
  mangaId,
}: {
  chapters: Chapter[];
  currentNum: number;
  mangaId: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll active item into view when opening
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 hover:text-white transition-all"
      >
        <List className="w-3.5 h-3.5" />
        <span className="font-medium">Ch.{currentNum}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-56 max-h-64 overflow-y-auto rounded-xl bg-[#111] border border-white/10 shadow-2xl shadow-black/60"
        >
          {chapters.map((ch) => {
            const isActive = ch.chapter_number === currentNum;
            return (
              <button
                key={ch.id}
                data-active={isActive}
                onClick={() => {
                  setOpen(false);
                  navigate({
                    to: "/manga/$id/chapter/$num",
                    params: { id: mangaId, num: String(ch.chapter_number) },
                  });
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${
                  isActive
                    ? "text-amber-400 font-semibold bg-amber-400/5"
                    : "text-white/50"
                }`}
              >
                Chương {ch.chapter_number}
                {ch.title ? (
                  <span className="text-white/30 ml-1 text-xs">
                    — {ch.title}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------
// PROGRESS BAR (THROTTLED RAF)
// ---------------------------
function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);
  const scrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scrollY.current = window.scrollY;
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(100, (scrollY.current / max) * 100) : 0);
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return progress;
}

// ---------------------------
// NAV BAR (reusable)
// ---------------------------
function NavBar({
  state,
  chapters,
  mangaId,
  chapterNum,
  go,
}: {
  state: ReturnType<typeof buildChapterState>;
  chapters: Chapter[];
  mangaId: string;
  chapterNum: number;
  go: (n?: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-3">
      <Button
        variant="ghost"
        disabled={!state.prev}
        onClick={() => go(state.prev?.chapter_number)}
        className="flex-1 max-w-[130px] gap-1 border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl h-9 text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Trước</span>
      </Button>

      <ChapterSelector
        chapters={chapters}
        currentNum={chapterNum}
        mangaId={mangaId}
      />

      <Button
        variant="ghost"
        disabled={!state.next}
        onClick={() => go(state.next?.chapter_number)}
        className="flex-1 max-w-[130px] gap-1 border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl h-9 text-sm"
      >
        <span className="hidden sm:inline">Sau</span>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ---------------------------
// MAIN COMPONENT
// ---------------------------
function Reader() {
  const { id, num } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const touchStartX = useRef<number | null>(null);

  // Parse + validate chapter number (before any hooks that use it)
  const chapterNum = Number(num);
  const isValidNum = Number.isFinite(chapterNum) && chapterNum >= 0;

  // ---------------------------
  // LOAD CHAPTER LIST
  // (enabled:false when num invalid → no hooks-order violation)
  // ---------------------------
  const {
    data: chapters = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["chapter-list", id],
    queryFn: () => fetchChapterList(id),
    staleTime: 1000 * 60 * 60,
    enabled: isValidNum,
  });

  const state = buildChapterState(chapters, chapterNum);
  const progress = useScrollProgress();

  // ---------------------------
  // VIEW COUNT (ANTI-SPAM)
  // ---------------------------
  useEffect(() => {
    if (!state.current?.id) return;
    const key = `viewed_${state.current.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void supabase.rpc("increment_chapter_views", {
      _chapter_id: state.current.id,
    });
  }, [state.current?.id]);

  // ---------------------------
  // SCROLL RESET ON CHAPTER CHANGE
  // ---------------------------
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterNum]);

  // ---------------------------
  // NAVIGATION (safe: null-check + isFinite)
  // ---------------------------
  const go = useCallback(
    (target?: number) => {
      if (target == null || !Number.isFinite(target)) return;
      navigate({
        to: "/manga/$id/chapter/$num",
        params: { id, num: String(target) },
      });
    },
    [navigate, id]
  );

  // ---------------------------
  // KEYBOARD ← →
  // ---------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") go(state.prev?.chapter_number);
      if (e.key === "ArrowRight") go(state.next?.chapter_number);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.prev, state.next, go]);

  // ---------------------------
  // SWIPE (MOBILE, PASSIVE)
  // ---------------------------
  useEffect(() => {
    const down = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const up = (e: TouchEvent) => {
      if (touchStartX.current == null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(diff) < 60) return;
      diff > 0 ? go(state.prev?.chapter_number) : go(state.next?.chapter_number);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchend", up);
    };
  }, [state.prev, state.next, go]);

  // ---------------------------
  // PREFETCH SURROUNDING (DEDUPED)
  // ---------------------------
  useEffect(() => {
    const safeList = Array.isArray(chapters) ? chapters : [];
    const idx = state.index >= 0 ? state.index : 0;

    const targets = [
      state.prev,
      state.next,
      safeList[idx - 2],
      safeList[idx + 2],
    ].filter(Boolean) as Chapter[];

    targets.forEach((ch) => {
      const key = ["chapter", id, ch.chapter_number];
      if (queryClient.getQueryData(key)) return;

      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: async () => {
          const { data, error } = await supabase
            .from("chapters")
            .select("id, chapter_number, pages, title")
            .eq("manga_id", id)
            .eq("chapter_number", ch.chapter_number)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        staleTime: 1000 * 60 * 10,
      });
    });
  }, [chapters, state.index, id, queryClient, state.prev, state.next]);

  // ---------------------------
  // INVALID NUM GUARD
  // (after all hooks — Rules of Hooks compliant)
  // ---------------------------
  if (!isValidNum) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/30 text-sm">
          Chapter không hợp lệ
        </div>
      </>
    );
  }

  // ---------------------------
  // LOADING STATE
  // ---------------------------
  if (isLoading || (!state.current && !isError)) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3 text-white/30">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span className="text-sm">Đang tải...</span>
        </div>
      </>
    );
  }

  // ---------------------------
  // ERROR / NOT FOUND STATE
  // ---------------------------
  if (isError || !state.current) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 text-white/30">
          <BookOpen className="w-10 h-10 opacity-20" />
          <p className="text-sm">Không tìm thấy chương này.</p>
          <Link
            to="/manga/$id"
            params={{ id }}
            className="text-amber-400/80 text-sm hover:text-amber-300 transition-colors"
          >
            ← Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  const pages = Array.isArray(state.current.pages) ? state.current.pages : [];

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Progress bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* ── Title ── */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold tracking-tight">
            Chương {chapterNum}
            {state.current.title && (
              <span className="text-white/40 font-normal ml-2 text-base">
                {state.current.title}
              </span>
            )}
          </h1>
          <p className="text-xs text-white/25 mt-1.5 hidden md:block">
            Dùng ← → để chuyển chương nhanh
          </p>
        </div>

        {/* ── Top nav ── */}
        <NavBar
          state={state}
          chapters={chapters}
          mangaId={id}
          chapterNum={chapterNum}
          go={go}
        />

        {/* ── Pages ── */}
        <div className="rounded-lg overflow-hidden ring-1 ring-white/5 shadow-xl shadow-black/40 mt-2">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-[#111] text-white/20 gap-3">
              <BookOpen className="w-8 h-8 opacity-20" />
              <p className="text-sm">Chương này chưa có trang nào.</p>
            </div>
          ) : (
            pages.map((src, i) => (
              <MangaPage key={src} src={src} index={i} />
            ))
          )}
        </div>

        {/* ── Bottom nav ── */}
        <NavBar
          state={state}
          chapters={chapters}
          mangaId={id}
          chapterNum={chapterNum}
          go={go}
        />

        {/* ── End of chapter CTA ── */}
        {state.next && (
          <div className="text-center pb-10">
            <button
              onClick={() => go(state.next?.chapter_number)}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30"
            >
              Đọc tiếp Chương {state.next.chapter_number}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { ChevronLeft, ChevronRight, List, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manga/$id/chapter/$num")({
  component: Reader,
});

// ---------------------------
// FETCHERS
// ---------------------------
async function fetchChapterList(mangaId: string) {
  const { data } = await supabase
    .from("chapters")
    .select("id, chapter_number, pages, title")
    .eq("manga_id", mangaId)
    .order("chapter_number");

  const list = data ?? [];
  return [...list].sort((a, b) => a.chapter_number - b.chapter_number);
}

function buildChapterState(list: any[], chapterNum: number) {
  const idx = list.findIndex((c) => c.chapter_number === chapterNum);

  return {
    current: list[idx] ?? null,
    prev: list[idx - 1] ?? null,
    next: list[idx + 1] ?? null,
    index: idx,
  };
}

// ---------------------------
// COMPONENT
// ---------------------------
function Reader() {
  const { id, num } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chapterNum = Number(num);

  const touchStartX = useRef<number | null>(null);

  // ---------------------------
  // LOAD CHAPTER LIST ONCE
  // ---------------------------
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapter-list", id],
    queryFn: () => fetchChapterList(id),
    staleTime: 1000 * 60 * 60, // 1h cache
  });

  const state = buildChapterState(chapters, chapterNum);

  // ---------------------------
  // VIEW COUNT (ANTI SPAM)
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
  // SCROLL RESET
  // ---------------------------
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as any });
  }, [chapterNum]);

  // ---------------------------
  // NAVIGATION
  // ---------------------------
  const goTo = useCallback(
    (target?: number) => {
      if (!target) return;
      navigate({
        to: "/manga/$id/chapter/$num",
        params: { id, num: String(target) },
      });
    },
    [navigate, id]
  );

  // ---------------------------
  // PREFETCH SURROUNDING CHAPTERS (±2)
  // ---------------------------
  useEffect(() => {
    const targets = [
      state.prev,
      state.next,
      chapters[state.index - 2],
      chapters[state.index + 2],
    ].filter(Boolean);

    targets.forEach((ch: any) => {
      queryClient.prefetchQuery({
        queryKey: ["chapter", id, ch.chapter_number],
        queryFn: async () => {
          const { data } = await supabase
            .from("chapters")
            .select("id, chapter_number, pages, title")
            .eq("manga_id", id)
            .eq("chapter_number", ch.chapter_number)
            .maybeSingle();

          return data;
        },
        staleTime: 1000 * 60 * 10,
      });
    });
  }, [state.index, chapters, id, queryClient]);

  // ---------------------------
  // SWIPE SUPPORT (MOBILE UX)
  // ---------------------------
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;

      const diff = e.changedTouches[0].clientX - touchStartX.current;

      // swipe threshold
      if (Math.abs(diff) > 60) {
        if (diff > 0) goTo(state.prev?.chapter_number);
        else goTo(state.next?.chapter_number);
      }

      touchStartX.current = null;
    };

    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [state.prev, state.next, goTo]);

  // ---------------------------
  // LOADING STATE
  // ---------------------------
  if (!state.current) {
    return (
      <>
        <Header />
        <div className="p-8 flex justify-center text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      </>
    );
  }

  const pages: string[] = Array.isArray(state.current.pages)
    ? state.current.pages
    : [];

  // ---------------------------
  // UI NAV
  // ---------------------------
  const nav = (
    <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
      <Button
        variant="outline"
        disabled={!state.prev}
        onClick={() => goTo(state.prev?.chapter_number)}
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Trước
      </Button>

      <Button asChild variant="secondary">
        <Link to="/manga/$id" params={{ id }}>
          <List className="w-4 h-4 mr-1" />
          Danh sách
        </Link>
      </Button>

      <Button
        variant="outline"
        disabled={!state.next}
        onClick={() => goTo(state.next?.chapter_number)}
      >
        Sau
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <>
      <Header />

      <main className="container mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">
          Chương {chapterNum} {state.current.title ? `: ${state.current.title}` : ""}
        </h1>

        {nav}

        {/* IMAGE RENDER (PRO MAX) */}
        <div className="max-w-3xl mx-auto">
          {pages.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`page-${i}`}
              className="w-full h-auto"
              loading={i < 2 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
            />
          ))}
        </div>

        {nav}
      </main>
    </>
  );
}

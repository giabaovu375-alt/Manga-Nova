// src/routes/manga/$id/chapter/$num.tsx — SIMPLE READER
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/manga/$id/chapter/$num")({
  component: SimpleReader,
});

async function fetchChapterList(mangaId: string) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, chapter_number, pages, title")
    .eq("manga_id", mangaId)
    .order("chapter_number");
  if (error) throw error;
  return (data ?? []).sort((a, b) => a.chapter_number - b.chapter_number);
}

function SimpleReader() {
  const { id, num } = Route.useParams();
  const navigate = useNavigate();
  const chapterNum = Number(num);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapter-list", id],
    queryFn: () => fetchChapterList(id),
    staleTime: 1000 * 60 * 60,
  });

  const idx = chapters.findIndex((c) => c.chapter_number === chapterNum);
  const current = chapters[idx] ?? null;
  const prev = chapters[idx - 1] ?? null;
  const next = chapters[idx + 1] ?? null;
  const pages = current?.pages ?? [];

  // Tăng view
  useEffect(() => {
    if (!current?.id) return;
    const key = `viewed_${current.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void supabase.rpc("increment_chapter_views", { _chapter_id: current.id });
  }, [current?.id]);

  const go = (target?: number) => {
    if (!target) return;
    navigate({
      to: "/manga/$id/chapter/$num",
      params: { id, num: String(target) },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3 text-white/40">
        <p className="text-sm">Không tìm thấy chương này.</p>
        <Link to="/manga/$id" params={{ id }} className="text-amber-400 text-sm hover:underline">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
      {/* Thanh điều hướng siêu đơn giản */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0a0a0a]/90 backdrop-blur border-t border-white/5">
        <button
          onClick={() => go(prev?.chapter_number)}
          disabled={!prev}
          className="flex items-center gap-1 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Trước
        </button>

        <span className="text-xs text-white/30">
          Ch. {chapterNum}
        </span>

        <button
          onClick={() => go(next?.chapter_number)}
          disabled={!next}
          className="flex items-center gap-1 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          Sau
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Danh sách ảnh */}
      <div className="pb-16">
        {pages.length === 0 ? (
          <div className="flex items-center justify-center py-32 text-white/20 text-sm">
            Chương này chưa có trang nào.
          </div>
        ) : (
          pages.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Trang ${i + 1}`}
              className="w-full h-auto"
              loading={i < 3 ? "eager" : "lazy"}
            />
          ))
        )}
      </div>
    </div>
  );
}

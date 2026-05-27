import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Header } from "@/components/Header";
import { MangaCard } from "@/components/MangaCard";
import { fetchFeatured, fetchMangaPage, PAGE_SIZE } from "@/lib/manga-queries";
import { Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Home,
});

function Home() {
  const { q, page } = Route.useSearch();

  const featured = useQuery({ queryKey: ["featured"], queryFn: fetchFeatured });
  const list = useQuery({
    queryKey: ["mangas", q, page],
    queryFn: () => fetchMangaPage(page, q),
  });

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-12">
        {!q && (
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-8 md:p-12">
            <div className="absolute -top-20 -right-20 size-72 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 size-72 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <span className="inline-block text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">MangaNova</span>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Vũ trụ truyện tranh<br />trong tầm tay bạn.
              </h1>
              <p className="mt-4 text-muted-foreground md:text-lg">Khám phá hàng ngàn bộ truyện được cập nhật mỗi ngày — đọc miễn phí, mọi lúc, mọi nơi.</p>
            </div>
          </section>
        )}

        {!q && featured.data && featured.data.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-5">
              <Flame className="text-primary" /> Truyện nổi bật
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {featured.data.map((m) => (
                <MangaCard key={m.id} {...m} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between mb-5 gap-3">
            <h2 className="text-2xl font-bold">
              {q ? `Kết quả cho "${q}"` : "Tất cả truyện"}
            </h2>
            <span className="text-sm text-muted-foreground">Trang {page}{totalPages > 1 ? ` / ${totalPages}` : ""}</span>
          </div>
          {list.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : list.data && list.data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                {list.data.items.map((m) => (
                  <MangaCard key={m.id} {...m} />
                ))}
              </div>
              <Pagination current={page} total={totalPages} q={q} />
            </>
          ) : (
            <p className="text-muted-foreground text-center py-12">Chưa có truyện nào.</p>
          )}
        </section>
      </main>
      <footer className="border-t border-border/60 mt-16 py-8 text-center text-sm text-muted-foreground">
        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold">MangaNova</span> © 2026 — Đọc truyện tranh online miễn phí.
      </footer>
    </>
  );
}

function Pagination({ current, total, q }: { current: number; total: number; q: string }) {
  if (total <= 1) return null;

  // Build a smart page list with ellipses: first, ..., neighbors, ..., last
  const pages: (number | "...")[] = [];
  const push = (p: number | "...") => pages.push(p);
  const window = 1; // neighbors on each side
  const left = Math.max(2, current - window);
  const right = Math.min(total - 1, current + window);
  push(1);
  if (left > 2) push("...");
  for (let i = left; i <= right; i++) push(i);
  if (right < total - 1) push("...");
  if (total > 1) push(total);

  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-1.5 flex-wrap">
      <Button asChild={current !== 1} size="icon" variant="outline" disabled={current === 1} className="rounded-full">
        {current === 1 ? <span><ChevronLeft className="size-4" /></span> : (
          <Link to="/" search={{ q, page: current - 1 }} aria-label="Trang trước"><ChevronLeft className="size-4" /></Link>
        )}
      </Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 text-muted-foreground select-none">…</span>
        ) : (
          <Button
            key={p}
            asChild={p !== current}
            size="icon"
            variant={p === current ? "default" : "outline"}
            className={p === current
              ? "rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 border-0"
              : "rounded-full"}
          >
            {p === current ? <span>{p}</span> : <Link to="/" search={{ q, page: p }}>{p}</Link>}
          </Button>
        ),
      )}
      <Button asChild={current !== total} size="icon" variant="outline" disabled={current === total} className="rounded-full">
        {current === total ? <span><ChevronRight className="size-4" /></span> : (
          <Link to="/" search={{ q, page: current + 1 }} aria-label="Trang sau"><ChevronRight className="size-4" /></Link>
        )}
      </Button>
    </nav>
  );
}

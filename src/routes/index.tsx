import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Header } from "@/components/Header";
import { MangaCard } from "@/components/MangaCard";
import { fetchFeatured, fetchMangaPage, PAGE_SIZE } from "@/lib/manga-queries";
import { Flame, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');

        .home-root {
          font-family: 'DM Sans', sans-serif;
          background: #0d0d0f;
          min-height: 100vh;
          color: #e8e6e1;
        }

        /* ── Hero ── */
        .hero {
          position: relative;
          overflow: hidden;
          padding: 72px 0 80px;
          text-align: center;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(232,184,75,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 80%, rgba(180,100,50,0.07) 0%, transparent 60%);
          z-index: 0;
        }
        .hero-grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(232,184,75,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,184,75,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }
        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 680px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #e8b84b;
          font-weight: 500;
          margin-bottom: 20px;
          padding: 5px 14px;
          border-radius: 999px;
          border: 1px solid rgba(232,184,75,0.25);
          background: rgba(232,184,75,0.06);
        }
        .hero-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 7vw, 64px);
          font-weight: 900;
          line-height: 1.1;
          color: #f0ece4;
          margin-bottom: 18px;
          letter-spacing: -0.02em;
        }
        .hero-title em {
          font-style: italic;
          background: linear-gradient(135deg, #e8b84b, #d4703a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 16px;
          color: #777;
          line-height: 1.7;
          max-width: 480px;
          margin: 0 auto;
        }

        /* ── Section headers ── */
        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #f0ece4;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-badge {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(232,184,75,0.1);
          color: #e8b84b;
          border: 1px solid rgba(232,184,75,0.2);
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
          margin: 0;
        }

        /* ── Skeleton ── */
        .skeleton {
          aspect-ratio: 2/3;
          border-radius: 12px;
          background: linear-gradient(90deg, #1a1a1e 25%, #222228 50%, #1a1a1e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Pagination ── */
        .page-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 14px;
          font-weight: 500;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: #999;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
        }
        .page-btn:hover:not(.active):not(.disabled) {
          border-color: rgba(232,184,75,0.4);
          color: #e8b84b;
          background: rgba(232,184,75,0.06);
        }
        .page-btn.active {
          background: linear-gradient(135deg, #e8b84b, #d4a033);
          color: #0d0d0f;
          border-color: transparent;
          font-weight: 700;
          box-shadow: 0 4px 16px rgba(232,184,75,0.3);
        }
        .page-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        /* ── Search result heading ── */
        .search-result-label {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #f0ece4;
        }
        .search-result-label span {
          color: #e8b84b;
          font-style: italic;
        }

        /* ── Footer ── */
        .site-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 80px;
          padding: 32px 20px;
          text-align: center;
          font-size: 13px;
          color: #444;
        }
        .site-footer strong {
          font-family: 'Playfair Display', serif;
          background: linear-gradient(135deg, #e8b84b, #d4703a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
        }
      `}</style>

      <div className="home-root">
        <Header />

        {/* ── Hero ── */}
        {!q && (
          <section className="hero">
            <div className="hero-bg" />
            <div className="hero-grid-lines" />
            <div className="hero-content">
              <div className="hero-eyebrow">
                <Sparkles size={11} />
                MangaNova
              </div>
              <h1 className="hero-title">
                Vũ trụ truyện tranh<br />
                <em>trong tầm tay bạn.</em>
              </h1>
              <p className="hero-sub">
                Khám phá hàng ngàn bộ truyện được cập nhật mỗi ngày — đọc miễn phí, mọi lúc, mọi nơi.
              </p>
            </div>
          </section>
        )}

        <div className="divider" />

        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>

          {/* ── Featured ── */}
          {!q && featured.data && featured.data.length > 0 && (
            <section style={{ marginBottom: 56 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 className="section-title">
                  <Flame size={20} color="#e8b84b" />
                  Truyện nổi bật
                  <span className="section-badge">{featured.data.length}</span>
                </h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                {featured.data.map((m) => <MangaCard key={m.id} {...m} />)}
              </div>
            </section>
          )}

          {/* ── All / Search ── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              {q ? (
                <p className="search-result-label">
                  Kết quả cho <span>"{q}"</span>
                </p>
              ) : (
                <h2 className="section-title">Tất cả truyện</h2>
              )}
              {totalPages > 1 && (
                <span style={{ fontSize: 13, color: "#555" }}>
                  Trang {page} / {totalPages}
                </span>
              )}
            </div>

            {list.isLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton" />)}
              </div>
            ) : list.data && list.data.items.length > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                  {list.data.items.map((m) => <MangaCard key={m.id} {...m} />)}
                </div>
                <Pagination current={page} total={totalPages} q={q} />
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "64px 0", color: "#555" }}>
                <p style={{ fontSize: 15 }}>{q ? `Không tìm thấy kết quả nào cho "${q}".` : "Chưa có truyện nào."}</p>
              </div>
            )}
          </section>
        </main>

        <footer className="site-footer">
          <strong>MangaNova</strong> © 2026 — Đọc truyện tranh online miễn phí.
        </footer>
      </div>
    </>
  );
}

function Pagination({ current, total, q }: { current: number; total: number; q: string }) {
  if (total <= 1) return null;

  const pages: (number | "...")[] = [];
  const push = (p: number | "...") => pages.push(p);
  const w = 1;
  const left = Math.max(2, current - w);
  const right = Math.min(total - 1, current + w);
  push(1);
  if (left > 2) push("...");
  for (let i = left; i <= right; i++) push(i);
  if (right < total - 1) push("...");
  if (total > 1) push(total);

  return (
    <nav style={{ marginTop: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
      {current === 1 ? (
        <span className="page-btn disabled"><ChevronLeft size={16} /></span>
      ) : (
        <Link to="/" search={{ q, page: current - 1 }} className="page-btn">
          <ChevronLeft size={16} />
        </Link>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} style={{ color: "#555", fontSize: 14, padding: "0 4px" }}>…</span>
        ) : p === current ? (
          <span key={p} className="page-btn active">{p}</span>
        ) : (
          <Link key={p} to="/" search={{ q, page: p as number }} className="page-btn">{p}</Link>
        )
      )}

      {current === total ? (
        <span className="page-btn disabled"><ChevronRight size={16} /></span>
      ) : (
        <Link to="/" search={{ q, page: current + 1 }} className="page-btn">
          <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}

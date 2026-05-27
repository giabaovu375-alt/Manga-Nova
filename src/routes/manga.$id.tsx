import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Star, Eye, BookOpen, ImageOff, ChevronRight, Clock, Hash } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/manga/$id")({ component: MangaDetail });

function MangaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [hoverStar, setHoverStar] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["manga", id],
    queryFn: async () => {
      const [{ data: manga }, { data: chapters }, { data: ratings }, { data: myRating }] = await Promise.all([
        supabase.from("mangas").select("*").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("*").eq("manga_id", id).order("chapter_number"),
        supabase.from("ratings").select("stars").eq("manga_id", id),
        user
          ? supabase.from("ratings").select("stars").eq("manga_id", id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const avg = ratings && ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : 0;
      return {
        manga,
        chapters: chapters ?? [],
        avg,
        count: ratings?.length ?? 0,
        myRating: (myRating as any)?.stars ?? 0,
      };
    },
  });

  const rate = async (stars: number) => {
    if (!user) return toast.error("Đăng nhập để đánh giá");
    const { error } = await supabase
      .from("ratings")
      .upsert({ manga_id: id, user_id: user.id, stars }, { onConflict: "manga_id,user_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Đã đánh giá!");
      qc.invalidateQueries({ queryKey: ["manga", id] });
    }
  };

  if (isLoading)
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#e8b84b] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#888] text-sm tracking-widest uppercase font-light">Đang tải...</p>
          </div>
        </div>
      </>
    );

  if (!data?.manga)
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center text-[#888]">
          Không tìm thấy truyện.
        </div>
      </>
    );

  const { manga, chapters, avg, count, myRating } = data;
  const displayStars = hoverStar || myRating || Math.round(avg);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');

        .manga-detail-root {
          font-family: 'DM Sans', sans-serif;
          background: #0d0d0f;
          min-height: 100vh;
          color: #e8e6e1;
        }

        .hero-blur {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center top;
          filter: blur(60px) brightness(0.25) saturate(1.4);
          transform: scale(1.1);
          z-index: 0;
        }

        .cover-shadow {
          box-shadow:
            0 8px 32px rgba(0,0,0,0.6),
            0 2px 8px rgba(232,184,75,0.08),
            inset 0 0 0 1px rgba(255,255,255,0.06);
        }

        .star-btn {
          background: none;
          border: none;
          padding: 2px;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .star-btn:hover { transform: scale(1.2); }

        .chapter-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          text-decoration: none;
          color: #e8e6e1;
          transition: all 0.2s ease;
          gap: 8px;
        }
        .chapter-item:hover {
          background: rgba(232,184,75,0.06);
          border-color: rgba(232,184,75,0.3);
          color: #e8b84b;
          transform: translateX(3px);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
          background: rgba(232,184,75,0.1);
          color: #e8b84b;
          border: 1px solid rgba(232,184,75,0.2);
        }

        .read-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 28px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          background: linear-gradient(135deg, #e8b84b, #d4a033);
          color: #0d0d0f;
          text-decoration: none;
          transition: all 0.2s ease;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 20px rgba(232,184,75,0.25);
        }
        .read-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(232,184,75,0.4);
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin: 32px 0;
        }

        .scroll-chapters {
          max-height: 520px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(232,184,75,0.3) transparent;
        }
        .scroll-chapters::-webkit-scrollbar { width: 4px; }
        .scroll-chapters::-webkit-scrollbar-thumb { background: rgba(232,184,75,0.3); border-radius: 4px; }

        .stat-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 14px 20px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          min-width: 90px;
        }
        .stat-box .val {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #e8b84b;
        }
        .stat-box .lbl {
          font-size: 11px;
          color: #666;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
      `}</style>

      <div className="manga-detail-root">
        <Header />

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
          {manga.cover_url && (
            <div className="hero-blur" style={{ backgroundImage: `url(${manga.cover_url})` }} />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(13,13,15,0.3) 0%, #0d0d0f 100%)",
              zIndex: 1,
            }}
          />

          <div
            className="container mx-auto px-4 py-10 relative"
            style={{ zIndex: 2, maxWidth: 1100 }}
          >
            <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" }}>
              {/* Cover */}
              <div
                className="cover-shadow"
                style={{
                  width: 200,
                  minWidth: 160,
                  aspectRatio: "2/3",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#1a1a1e",
                  flexShrink: 0,
                }}
              >
                {manga.cover_url ? (
                  <img
                    src={manga.cover_url}
                    alt={manga.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#444",
                    }}
                  >
                    <ImageOff size={40} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 8 }}>
                <h1
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(24px, 5vw, 42px)",
                    fontWeight: 900,
                    lineHeight: 1.15,
                    marginBottom: 16,
                    color: "#f0ece4",
                    textShadow: "0 2px 20px rgba(0,0,0,0.5)",
                  }}
                >
                  {manga.title}
                </h1>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                  <div className="stat-box">
                    <span className="val">{avg.toFixed(1)}</span>
                    <span className="lbl">Đánh giá</span>
                  </div>
                  <div className="stat-box">
                    <span className="val">{count}</span>
                    <span className="lbl">Lượt vote</span>
                  </div>
                  <div className="stat-box">
                    <span className="val">{chapters.length}</span>
                    <span className="lbl">Chương</span>
                  </div>
                </div>

                {/* Stars */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className="star-btn"
                      onMouseEnter={() => setHoverStar(n)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => rate(n)}
                    >
                      <Star
                        size={22}
                        style={{
                          fill: n <= displayStars ? "#e8b84b" : "none",
                          color: n <= displayStars ? "#e8b84b" : "#444",
                          transition: "all 0.15s",
                        }}
                      />
                    </button>
                  ))}
                  <span style={{ fontSize: 13, color: "#666", marginLeft: 4 }}>
                    {myRating ? `Bạn chấm ${myRating}★` : "Chưa đánh giá"}
                  </span>
                </div>

                {/* CTA */}
                {chapters.length > 0 && (
                  <Link
                    to="/manga/$id/chapter/$num"
                    params={{ id, num: String(chapters[0].chapter_number) }}
                    className="read-btn"
                  >
                    <BookOpen size={18} />
                    Đọc từ chương {chapters[0].chapter_number}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="container mx-auto px-4 pb-16" style={{ maxWidth: 1100 }}>
          {/* Description */}
          {manga.description && (
            <>
              <div className="divider" />
              <section>
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 14,
                    color: "#f0ece4",
                  }}
                >
                  Giới thiệu
                </h2>
                <p
                  style={{
                    color: "#999",
                    lineHeight: 1.85,
                    whiteSpace: "pre-wrap",
                    fontSize: 15,
                    maxWidth: 720,
                  }}
                >
                  {manga.description}
                </p>
              </section>
            </>
          )}

          <div className="divider" />

          {/* Chapters */}
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#f0ece4",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                Danh sách chương
                <span className="badge">
                  <Hash size={11} />
                  {chapters.length}
                </span>
              </h2>
              {chapters.length > 0 && (
                <Link
                  to="/manga/$id/chapter/$num"
                  params={{ id, num: String(chapters[chapters.length - 1].chapter_number) }}
                  style={{
                    fontSize: 13,
                    color: "#e8b84b",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    opacity: 0.8,
                  }}
                >
                  Chương mới nhất <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {chapters.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 0",
                  color: "#555",
                  fontSize: 15,
                }}
              >
                Chưa có chương nào được đăng.
              </div>
            ) : (
              <div
                className="scroll-chapters"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 8,
                  paddingRight: 4,
                }}
              >
                {chapters.map((c, i) => (
                  <Link
                    key={c.id}
                    to="/manga/$id/chapter/$num"
                    params={{ id, num: String(c.chapter_number) }}
                    className="chapter-item"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#555",
                          fontWeight: 500,
                          minWidth: 28,
                          textAlign: "right",
                        }}
                      >
                        #{i + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Chương {c.chapter_number}
                        {c.title ? `: ${c.title}` : ""}
                      </span>
                    </div>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: "#555",
                        flexShrink: 0,
                      }}
                    >
                      <Eye size={12} />
                      {c.views?.toLocaleString() ?? 0}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}       

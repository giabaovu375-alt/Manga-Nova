// src/routes/manga.$id.tsx
import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
} from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import {
  Star,
  Eye,
  BookOpen,
  ImageOff,
  ChevronRight,
  Hash,
  MessageSquare,
  Send,
  Trash2,
  ThumbsUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useState, useRef } from "react";

export const Route = createFileRoute("/manga/$id")({ component: MangaDetail });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chapter {
  id: string;
  chapter_number: number;
  title?: string;
  views?: number;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes?: number;
  profiles?: { username?: string; avatar_url?: string };
}

interface MangaSummary {
  id: string;
  title: string;
  cover_url?: string;
  genres?: string[];
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchMangaDetail(id: string, userId?: string) {
  const [
    { data: manga },
    { data: chapters },
    { data: ratings },
    { data: myRating },
    { data: comments },
  ] = await Promise.all([
    supabase.from("mangas").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("chapters")
      .select("id,chapter_number,title,views")
      .eq("manga_id", id)
      .order("chapter_number"),
    supabase.from("ratings").select("stars").eq("manga_id", id),
    userId
      ? supabase
          .from("ratings")
          .select("stars")
          .eq("manga_id", id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("comments")
      .select("id,user_id,content,created_at,likes,profiles(username,avatar_url)")
      .eq("manga_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const avg =
    ratings && ratings.length
      ? ratings.reduce((s: number, r: { stars: number }) => s + r.stars, 0) /
        ratings.length
      : 0;

  return {
    manga,
    chapters: (chapters ?? []) as Chapter[],
    avg,
    ratingCount: ratings?.length ?? 0,
    myRating: (myRating as any)?.stars ?? 0,
    comments: (comments ?? []) as Comment[],
  };
}

async function fetchSuggestions(mangaId: string): Promise<MangaSummary[]> {
  // Fetch same-genre suggestions — fallback to latest 6 mangas if no genres
  const { data: current } = await supabase
    .from("mangas")
    .select("genres")
    .eq("id", mangaId)
    .maybeSingle();

  const genres: string[] = current?.genres ?? [];

  let query = supabase
    .from("mangas")
    .select("id,title,cover_url,genres")
    .neq("id", mangaId)
    .limit(6);

  if (genres.length > 0) {
    query = query.overlaps("genres", genres);
  }

  const { data } = await query;
  return (data ?? []) as MangaSummary[];
}

// ─── Main Component ────────────────────────────────────────────────────────────

function MangaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const childMatches = useChildMatches();

  const [hoverStar, setHoverStar] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [showAllChapters, setShowAllChapters] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["manga", id, user?.id],
    queryFn: () => fetchMangaDetail(id, user?.id),
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["suggestions", id],
    queryFn: () => fetchSuggestions(id),
    staleTime: 1000 * 60 * 10,
  });

  // ── Rating mutation ──
  const rateMutation = useMutation({
    mutationFn: async (stars: number) => {
      if (!user) throw new Error("not_logged_in");
      const { error } = await supabase
        .from("ratings")
        .upsert(
          { manga_id: id, user_id: user.id, stars },
          { onConflict: "manga_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã lưu đánh giá!");
      qc.invalidateQueries({ queryKey: ["manga", id] });
    },
    onError: (e: Error) => {
      if (e.message === "not_logged_in") toast.error("Đăng nhập để đánh giá");
      else toast.error("Lỗi: " + e.message);
    },
  });

  // ── Comment mutations ──
  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("not_logged_in");
      const { error } = await supabase
        .from("comments")
        .insert({ manga_id: id, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["manga", id] });
      toast.success("Đã đăng bình luận!");
    },
    onError: (e: Error) => {
      if (e.message === "not_logged_in") toast.error("Đăng nhập để bình luận");
      else toast.error("Lỗi: " + e.message);
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", id] });
      toast.success("Đã xoá bình luận");
    },
  });

  const likeComment = useMutation({
    mutationFn: async (commentId: string) => {
      await supabase.rpc("increment_comment_likes", {
        _comment_id: commentId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manga", id] }),
  });

  if (childMatches.length > 0) return <Outlet />;

  if (isLoading)
    return (
      <>
        <Header />
        <div className="detail-loading">
          <div className="detail-spinner" />
          <p>Đang tải...</p>
        </div>
      </>
    );

  if (!data?.manga)
    return (
      <>
        <Header />
        <div className="detail-loading">
          <p style={{ color: "#555" }}>Không tìm thấy truyện.</p>
        </div>
      </>
    );

  const { manga, chapters, avg, ratingCount, myRating, comments } = data;
  const displayStars = hoverStar || myRating;
  const visibleChapters = showAllChapters ? chapters : chapters.slice(0, 20);
  const totalViews = chapters.reduce((s, c) => s + (c.views ?? 0), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Noto+Serif+Display:ital,wght@0,700;0,900;1,700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ─── CSS VARS ─── */
        :root {
          --gold:      #e8b84b;
          --gold-dim:  #c9952a;
          --gold-glow: rgba(232,184,75,0.18);
          --bg:        #0c0c0e;
          --surface:   #141418;
          --surface2:  #1a1a20;
          --border:    rgba(255,255,255,0.07);
          --text:      #e8e6e1;
          --muted:     #888;
          --faint:     #444;
        }

        @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes shimmer  { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes pulse    { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes starPop  { 0%{transform:scale(1)} 50%{transform:scale(1.4)} 100%{transform:scale(1)} }

        .manga-detail-root {
          font-family: 'Sora', sans-serif;
          background: var(--bg);
          min-height: 100vh;
          color: var(--text);
          animation: fadeUp .45s ease both;
        }

        /* ─── LOADING ─── */
        .detail-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg);
          gap: 16px;
          font-family: 'Sora', sans-serif;
          color: var(--muted);
          font-size: 13px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .detail-spinner {
          width: 36px; height: 36px;
          border: 2px solid rgba(232,184,75,.15);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── HERO ─── */
        .hero {
          position: relative;
          overflow: hidden;
          padding-bottom: 0;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background-size: cover;
          background-position: center top;
          filter: blur(72px) brightness(.18) saturate(1.8);
          transform: scale(1.15);
          z-index: 0;
        }
        .hero-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(12,12,14,.2) 0%,
            rgba(12,12,14,.65) 55%,
            var(--bg) 100%);
          z-index: 1;
        }
        .hero-inner {
          position: relative; z-index: 2;
          max-width: 1080px;
          margin: 0 auto;
          padding: 48px 24px 0;
          display: flex;
          gap: 40px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        /* ─── COVER ─── */
        .cover-wrap {
          width: 190px;
          min-width: 140px;
          aspect-ratio: 2/3;
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface);
          flex-shrink: 0;
          position: relative;
          box-shadow:
            0 12px 48px rgba(0,0,0,.7),
            0 0 0 1px rgba(255,255,255,.07),
            0 0 0 4px rgba(232,184,75,.05);
        }
        .cover-wrap img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
          transition: transform .4s ease;
        }
        .cover-wrap:hover img { transform: scale(1.04); }
        .cover-no-img {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: var(--faint);
        }

        /* ─── HERO INFO ─── */
        .hero-info {
          flex: 1; min-width: 0;
          padding-bottom: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .hero-title {
          font-family: 'Noto Serif Display', serif;
          font-size: clamp(26px, 5vw, 46px);
          font-weight: 900;
          line-height: 1.1;
          color: #f5f0e8;
          text-shadow: 0 2px 24px rgba(0,0,0,.6);
          letter-spacing: -.01em;
        }

        /* ─── GENRE TAGS ─── */
        .genre-list {
          display: flex; gap: 7px; flex-wrap: wrap;
        }
        .genre-tag {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .07em;
          text-transform: uppercase;
          padding: 4px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.09);
          color: var(--muted);
        }

        /* ─── STATS ROW ─── */
        .stats-row {
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        .stat-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 12px 18px;
          border-radius: 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid var(--border);
          min-width: 82px;
        }
        .stat-val {
          font-family: 'Noto Serif Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--gold);
          line-height: 1;
        }
        .stat-lbl {
          font-size: 10px;
          color: #555;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        /* ─── STAR RATING ─── */
        .rating-wrap {
          display: flex; flex-direction: column; gap: 10px;
        }
        .rating-label {
          font-size: 11px;
          font-weight: 600;
          color: #555;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .stars-row {
          display: flex; align-items: center; gap: 4px;
        }
        .star-btn {
          background: none; border: none; padding: 3px; cursor: pointer;
          line-height: 0;
          transition: transform .12s;
        }
        .star-btn:hover { transform: scale(1.25); }
        .star-btn:active { transform: scale(.9); }
        .star-btn.rated { animation: starPop .25s ease; }

        .rating-breakdown {
          display: flex; flex-direction: column; gap: 5px;
          max-width: 260px;
        }
        .rating-bar-row {
          display: flex; align-items: center; gap: 8px;
        }
        .rating-bar-lbl {
          font-size: 11px; color: #555; min-width: 14px; text-align: right;
        }
        .rating-bar-track {
          flex: 1; height: 5px;
          background: rgba(255,255,255,.06);
          border-radius: 99px;
          overflow: hidden;
        }
        .rating-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--gold-dim), var(--gold));
          border-radius: 99px;
          transition: width .5s cubic-bezier(.4,0,.2,1);
        }
        .rating-bar-cnt {
          font-size: 10px; color: #444; min-width: 20px;
        }

        /* ─── CTA BUTTONS ─── */
        .cta-row {
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        .btn-primary {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 13px 28px;
          border-radius: 11px;
          font-size: 14px; font-weight: 700;
          font-family: 'Sora', sans-serif;
          background: linear-gradient(135deg, #e8b84b 0%, #c9952a 100%);
          color: #0c0c0e;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 20px rgba(232,184,75,.28);
          transition: all .18s;
          letter-spacing: .01em;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(232,184,75,.42);
          filter: brightness(1.08);
        }
        .btn-primary:active { transform: scale(.96); }

        /* ─── BODY ─── */
        .body-wrap {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
          margin: 36px 0;
        }

        .section-title {
          font-family: 'Noto Serif Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: #f0ece4;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .section-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px; font-weight: 600;
          background: var(--gold-glow);
          color: var(--gold);
          border: 1px solid rgba(232,184,75,.2);
          font-family: 'Sora', sans-serif;
        }

        /* ─── DESCRIPTION ─── */
        .description {
          color: #8a8880;
          line-height: 1.9;
          font-size: 14.5px;
          white-space: pre-wrap;
          max-width: 700px;
        }

        /* ─── CHAPTERS ─── */
        .chapters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 7px;
        }
        .chapter-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          text-decoration: none;
          color: var(--text);
          transition: all .18s;
          gap: 8px;
        }
        .chapter-item:hover {
          background: rgba(232,184,75,.07);
          border-color: rgba(232,184,75,.28);
          color: var(--gold);
          transform: translateX(3px);
        }
        .chapter-num {
          font-size: 10px;
          font-weight: 700;
          color: var(--faint);
          min-width: 32px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .chapter-name {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chapter-views {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px;
          color: #3a3a3a;
          flex-shrink: 0;
        }

        .show-more-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%;
          margin-top: 10px;
          padding: 11px;
          border-radius: 10px;
          background: rgba(255,255,255,.03);
          border: 1px solid var(--border);
          color: #666;
          font-size: 13px; font-weight: 600;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          transition: all .15s;
        }
        .show-more-btn:hover {
          background: rgba(255,255,255,.06);
          color: #aaa;
        }

        /* ─── SUGGESTIONS ─── */
        .suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 14px;
        }
        .suggestion-card {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .suggestion-cover {
          width: 100%;
          aspect-ratio: 2/3;
          border-radius: 10px;
          overflow: hidden;
          background: var(--surface2);
          border: 1px solid var(--border);
          position: relative;
        }
        .suggestion-cover img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
          transition: transform .35s ease;
        }
        .suggestion-card:hover .suggestion-cover img {
          transform: scale(1.06);
        }
        .suggestion-cover-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: var(--faint);
        }
        .suggestion-title {
          font-size: 12px;
          font-weight: 600;
          color: #bbb;
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          transition: color .15s;
        }
        .suggestion-card:hover .suggestion-title { color: var(--gold); }

        /* ─── COMMENTS ─── */
        .comment-input-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 20px;
          transition: border-color .18s;
        }
        .comment-input-wrap:focus-within {
          border-color: rgba(232,184,75,.35);
        }
        .comment-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: 'Sora', sans-serif;
          font-size: 14px;
          line-height: 1.7;
          resize: none;
          min-height: 72px;
        }
        .comment-textarea::placeholder { color: #3a3a3a; }
        .comment-input-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(255,255,255,.05);
          padding-top: 10px;
        }
        .comment-char {
          font-size: 11px; color: #333;
        }
        .btn-send {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 20px;
          border-radius: 9px;
          font-size: 13px; font-weight: 700;
          font-family: 'Sora', sans-serif;
          background: linear-gradient(135deg, #e8b84b 0%, #c9952a 100%);
          color: #0c0c0e;
          border: none; cursor: pointer;
          box-shadow: 0 3px 14px rgba(232,184,75,.25);
          transition: all .15s;
        }
        .btn-send:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .btn-send:disabled {
          opacity: .35; cursor: not-allowed; transform: none;
        }

        .comment-login-hint {
          text-align: center;
          padding: 22px;
          border-radius: 12px;
          background: rgba(255,255,255,.02);
          border: 1px dashed rgba(255,255,255,.08);
          font-size: 13px;
          color: #555;
          margin-bottom: 20px;
        }
        .comment-login-hint a {
          color: var(--gold);
          text-decoration: none;
          font-weight: 600;
        }

        .comments-list {
          display: flex; flex-direction: column; gap: 2px;
        }
        .comment-card {
          padding: 16px;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid transparent;
          transition: border-color .15s;
          animation: fadeUp .3s ease both;
        }
        .comment-card:hover {
          border-color: var(--border);
        }
        .comment-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px;
        }
        .comment-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--surface2);
          border: 1px solid var(--border);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: #444;
        }
        .comment-avatar img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .comment-meta {
          flex: 1; min-width: 0;
        }
        .comment-username {
          font-size: 13px; font-weight: 700; color: #ddd;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .comment-time {
          font-size: 11px; color: #3a3a3a; margin-top: 1px;
        }
        .comment-body {
          font-size: 14px; line-height: 1.75;
          color: #999;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .comment-actions {
          display: flex; align-items: center; gap: 8px;
          margin-top: 12px;
        }
        .comment-action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px;
          border-radius: 7px;
          font-size: 12px; font-weight: 600;
          font-family: 'Sora', sans-serif;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.06);
          color: #555; cursor: pointer;
          transition: all .12s;
        }
        .comment-action-btn:hover {
          background: rgba(255,255,255,.08); color: #aaa;
        }
        .comment-action-btn.like:hover {
          background: rgba(232,184,75,.1);
          border-color: rgba(232,184,75,.2);
          color: var(--gold);
        }
        .comment-action-btn.delete:hover {
          background: rgba(255,80,80,.08);
          border-color: rgba(255,80,80,.15);
          color: #ff5050;
        }

        .no-comments {
          text-align: center;
          padding: 48px 0;
          color: #333;
          font-size: 14px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }

        /* ─── MOBILE ─── */
        @media (max-width: 640px) {
          .hero-inner {
            flex-direction: column;
            align-items: center;
            padding: 32px 16px 0;
            gap: 24px;
          }
          .cover-wrap {
            width: 150px; min-width: 150px;
          }
          .hero-info {
            width: 100%;
            align-items: center;
            text-align: center;
            padding-bottom: 20px;
          }
          .hero-title { text-align: center; }
          .genre-list, .stats-row, .stars-row, .cta-row {
            justify-content: center;
          }
          .rating-breakdown { margin: 0 auto; }
          .body-wrap { padding: 0 16px 60px; }
          .suggestions-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
          }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .hero-inner { padding: 40px 20px 0; }
        }
      `}</style>

      <div className="manga-detail-root">
        <Header />

        {/* ── Hero ── */}
        <div className="hero">
          {manga.cover_url && (
            <div
              className="hero-bg"
              style={{ backgroundImage: `url(${manga.cover_url})` }}
            />
          )}
          <div className="hero-gradient" />

          <div className="hero-inner">
            {/* Cover */}
            <div className="cover-wrap">
              {manga.cover_url ? (
                <img src={manga.cover_url} alt={manga.title} />
              ) : (
                <div className="cover-no-img">
                  <ImageOff size={40} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="hero-info">
              <h1 className="hero-title">{manga.title}</h1>

              {/* Genre tags */}
              {manga.genres?.length > 0 && (
                <div className="genre-list">
                  {manga.genres.map((g: string) => (
                    <span key={g} className="genre-tag">{g}</span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="stats-row">
                <div className="stat-pill">
                  <span className="stat-val">{avg.toFixed(1)}</span>
                  <span className="stat-lbl">Điểm</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-val">{data.ratingCount}</span>
                  <span className="stat-lbl">Vote</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-val">{chapters.length}</span>
                  <span className="stat-lbl">Chương</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-val">
                    {totalViews >= 1000
                      ? `${(totalViews / 1000).toFixed(1)}k`
                      : totalViews}
                  </span>
                  <span className="stat-lbl">Lượt xem</span>
                </div>
              </div>

              {/* Star rating */}
              <div className="rating-wrap">
                <span className="rating-label">
                  {myRating
                    ? `Bạn đã chấm ${myRating} sao`
                    : "Đánh giá của bạn"}
                </span>
                <div className="stars-row">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className={`star-btn${rateMutation.isPending ? " rated" : ""}`}
                      onMouseEnter={() => setHoverStar(n)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => rateMutation.mutate(n)}
                      disabled={rateMutation.isPending}
                      aria-label={`${n} sao`}
                    >
                      <Star
                        size={24}
                        style={{
                          fill:
                            n <= (displayStars || Math.round(avg))
                              ? "#e8b84b"
                              : "none",
                          color:
                            n <= (displayStars || Math.round(avg))
                              ? "#e8b84b"
                              : "#2e2e2e",
                          transition: "all .15s",
                          filter:
                            n <= (displayStars || Math.round(avg))
                              ? "drop-shadow(0 0 4px rgba(232,184,75,.5))"
                              : "none",
                        }}
                      />
                    </button>
                  ))}
                </div>

                {/* Rating breakdown bars */}
                <RatingBars mangaId={id} />
              </div>

              {/* CTA */}
              {chapters.length > 0 && (
                <div className="cta-row">
                  <Link
                    to="/manga/$id/chapter/$num"
                    params={{ id, num: String(chapters[0].chapter_number) }}
                    className="btn-primary"
                  >
                    <BookOpen size={16} />
                    Đọc từ đầu
                  </Link>
                  {chapters.length > 1 && (
                    <Link
                      to="/manga/$id/chapter/$num"
                      params={{
                        id,
                        num: String(chapters[chapters.length - 1].chapter_number),
                      }}
                      className="btn-primary"
                      style={{
                        background:
                          "linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.04))",
                        color: "#ccc",
                        boxShadow: "none",
                        border: "1px solid rgba(255,255,255,.09)",
                      }}
                    >
                      <ChevronRight size={16} />
                      Chương mới nhất
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="body-wrap">

          {/* Description */}
          {manga.description && (
            <>
              <div className="section-divider" />
              <section>
                <h2 className="section-title">Giới thiệu</h2>
                <p className="description">{manga.description}</p>
              </section>
            </>
          )}

          <div className="section-divider" />

          {/* ── Chapters ── */}
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Danh sách chương
                <span className="section-badge">
                  <Hash size={11} />
                  {chapters.length}
                </span>
              </h2>
            </div>

            {chapters.length === 0 ? (
              <p style={{ color: "#444", fontSize: 14, padding: "32px 0" }}>
                Chưa có chương nào.
              </p>
            ) : (
              <>
                <div className="chapters-grid">
                  {visibleChapters.map((c, i) => (
                    <Link
                      key={c.id}
                      to="/manga/$id/chapter/$num"
                      params={{ id, num: String(c.chapter_number) }}
                      className="chapter-item"
                    >
                      <span className="chapter-num">#{i + 1}</span>
                      <span className="chapter-name">
                        Ch.{c.chapter_number}
                        {c.title ? `: ${c.title}` : ""}
                      </span>
                      <span className="chapter-views">
                        <Eye size={11} />
                        {(c.views ?? 0).toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>

                {chapters.length > 20 && (
                  <button
                    className="show-more-btn"
                    onClick={() => setShowAllChapters((v) => !v)}
                  >
                    {showAllChapters ? (
                      <>
                        <ChevronUp size={15} /> Thu gọn
                      </>
                    ) : (
                      <>
                        <ChevronDown size={15} />
                        Xem thêm {chapters.length - 20} chương
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </section>

          {/* ── Suggestions ── */}
          {suggestions.length > 0 && (
            <>
              <div className="section-divider" />
              <section>
                <h2 className="section-title">
                  <Sparkles size={18} style={{ color: "var(--gold)" }} />
                  Có thể bạn thích
                </h2>
                <div className="suggestions-grid">
                  {suggestions.map((s) => (
                    <Link
                      key={s.id}
                      to="/manga/$id"
                      params={{ id: s.id }}
                      className="suggestion-card"
                    >
                      <div className="suggestion-cover">
                        {s.cover_url ? (
                          <img src={s.cover_url} alt={s.title} />
                        ) : (
                          <div className="suggestion-cover-placeholder">
                            <ImageOff size={24} />
                          </div>
                        )}
                      </div>
                      <span className="suggestion-title">{s.title}</span>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── Comments ── */}
          <div className="section-divider" />
          <section>
            <h2 className="section-title">
              <MessageSquare size={18} style={{ color: "var(--gold)" }} />
              Bình luận
              <span className="section-badge">{comments.length}</span>
            </h2>

            {/* Input */}
            {user ? (
              <div className="comment-input-wrap">
                <textarea
                  ref={commentRef}
                  className="comment-textarea"
                  placeholder="Chia sẻ cảm nghĩ của bạn về bộ này..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      if (commentText.trim()) addComment.mutate(commentText.trim());
                    }
                  }}
                />
                <div className="comment-input-actions">
                  <span className="comment-char">
                    {commentText.length}/500 · Ctrl+Enter để gửi
                  </span>
                  <button
                    className="btn-send"
                    disabled={!commentText.trim() || addComment.isPending}
                    onClick={() => {
                      if (commentText.trim()) addComment.mutate(commentText.trim());
                    }}
                  >
                    <Send size={13} />
                    {addComment.isPending ? "Đang gửi..." : "Gửi"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="comment-login-hint">
                <a href="/login">Đăng nhập</a> để bình luận
              </div>
            )}

            {/* Comment list */}
            {comments.length === 0 ? (
              <div className="no-comments">
                <MessageSquare size={36} style={{ color: "#222" }} />
                <span>Chưa có bình luận nào. Hãy là người đầu tiên!</span>
              </div>
            ) : (
              <div className="comments-list">
                {comments.map((c) => (
                  <CommentCard
                    key={c.id}
                    comment={c}
                    currentUserId={user?.id}
                    onLike={() => likeComment.mutate(c.id)}
                    onDelete={() => {
                      if (confirm("Xoá bình luận này?"))
                        deleteComment.mutate(c.id);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RatingBars({ mangaId }: { mangaId: string }) {
  const { data } = useQuery({
    queryKey: ["rating-breakdown", mangaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ratings")
        .select("stars")
        .eq("manga_id", mangaId);
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      (data ?? []).forEach(({ stars }: { stars: number }) => {
        counts[stars] = (counts[stars] ?? 0) + 1;
      });
      const total = (data ?? []).length;
      return { counts, total };
    },
    staleTime: 30_000,
  });

  if (!data || data.total === 0) return null;

  return (
    <div className="rating-breakdown">
      {[5, 4, 3, 2, 1].map((n) => {
        const cnt = data.counts[n] ?? 0;
        const pct = data.total > 0 ? (cnt / data.total) * 100 : 0;
        return (
          <div key={n} className="rating-bar-row">
            <span className="rating-bar-lbl">{n}</span>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="rating-bar-cnt">{cnt}</span>
          </div>
        );
      })}
    </div>
  );
}

function CommentCard({
  comment,
  currentUserId,
  onLike,
  onDelete,
}: {
  comment: Comment;
  currentUserId?: string;
  onLike: () => void;
  onDelete: () => void;
}) {
  const isOwner = currentUserId === comment.user_id;
  const username =
    comment.profiles?.username ??
    `user_${comment.user_id.slice(0, 6)}`;
  const avatar = comment.profiles?.avatar_url;

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "vừa xong";
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} ngày trước`;
    return new Date(iso).toLocaleDateString("vi-VN");
  };

  return (
    <div className="comment-card">
      <div className="comment-header">
        <div className="comment-avatar">
          {avatar ? (
            <img src={avatar} alt={username} />
          ) : (
            <UserCircle2 size={20} />
          )}
        </div>
        <div className="comment-meta">
          <div className="comment-username">{username}</div>
          <div className="comment-time">{timeAgo(comment.created_at)}</div>
        </div>
      </div>
      <p className="comment-body">{comment.content}</p>
      <div className="comment-actions">
        <button className="comment-action-btn like" onClick={onLike}>
          <ThumbsUp size={12} />
          {comment.likes ?? 0}
        </button>
        {isOwner && (
          <button className="comment-action-btn delete" onClick={onDelete}>
            <Trash2 size={12} />
            Xoá
          </button>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Star, Eye, BookOpen, ImageOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/manga/$id")({ component: MangaDetail });

function MangaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["manga", id],
    queryFn: async () => {
      const [{ data: manga }, { data: chapters }, { data: ratings }, { data: myRating }] = await Promise.all([
        supabase.from("mangas").select("*").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("*").eq("manga_id", id).order("chapter_number"),
        supabase.from("ratings").select("stars").eq("manga_id", id),
        user ? supabase.from("ratings").select("stars").eq("manga_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const avg = ratings && ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : 0;
      return { manga, chapters: chapters ?? [], avg, count: ratings?.length ?? 0, myRating: (myRating as any)?.stars ?? 0 };
    },
  });

  const rate = async (stars: number) => {
    if (!user) return toast.error("Đăng nhập để đánh giá");
    const { error } = await supabase.from("ratings").upsert({ manga_id: id, user_id: user.id, stars }, { onConflict: "manga_id,user_id" });
    if (error) toast.error(error.message);
    else { toast.success("Đã đánh giá!"); qc.invalidateQueries({ queryKey: ["manga", id] }); }
  };

  if (isLoading) return (<><Header /><div className="container mx-auto p-8 text-center text-muted-foreground">Đang tải...</div></>);
  if (!data?.manga) return (<><Header /><div className="container mx-auto p-8 text-center">Không tìm thấy truyện.</div></>);

  const { manga, chapters, avg, count, myRating } = data;

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-card border border-border max-w-xs mx-auto md:mx-0 w-full">
            {manga.cover_url ? <img src={manga.cover_url} alt={manga.title} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center text-muted-foreground"><ImageOff /></div>}
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">{manga.title}</h1>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)} className="hover:scale-110 transition">
                  <Star className={`size-6 ${n <= (myRating || Math.round(avg)) ? "fill-[var(--star)] text-[var(--star)]" : "text-muted-foreground"}`} />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{avg.toFixed(1)} • {count} đánh giá</span>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap">{manga.description || "Chưa có mô tả."}</p>
            {chapters.length > 0 && (
              <Button asChild size="lg">
                <Link to="/manga/$id/chapter/$num" params={{ id, num: String(chapters[0].chapter_number) }}>
                  <BookOpen className="size-4 mr-2" />Đọc từ chương {chapters[0].chapter_number}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold mb-3">Danh sách chương ({chapters.length})</h2>
          {chapters.length === 0 ? (
            <p className="text-muted-foreground">Chưa có chương nào.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {chapters.map((c) => (
                <li key={c.id}>
                  <Link to="/manga/$id/chapter/$num" params={{ id, num: String(c.chapter_number) }}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary transition">
                    <span className="font-medium">Chương {c.chapter_number}{c.title ? `: ${c.title}` : ""}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="size-3" />{c.views}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

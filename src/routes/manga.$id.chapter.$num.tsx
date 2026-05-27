import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/manga/$id/chapter/$num")({ component: Reader });

function Reader() {
  const { id, num } = Route.useParams();
  const navigate = useNavigate();
  const n = parseInt(num, 10);

  const { data } = useQuery({
    queryKey: ["chapter", id, n],
    queryFn: async () => {
      const [{ data: manga }, { data: chapters }] = await Promise.all([
        supabase.from("mangas").select("title").eq("id", id).maybeSingle(),
        supabase.from("chapters").select("*").eq("manga_id", id).order("chapter_number"),
      ]);
      const idx = (chapters ?? []).findIndex((c) => c.chapter_number === n);
      return { manga, chapters: chapters ?? [], current: chapters?.[idx], prev: chapters?.[idx - 1], next: chapters?.[idx + 1] };
    },
  });

  useEffect(() => {
    if (data?.current) supabase.rpc("increment_chapter_views", { _chapter_id: data.current.id });
  }, [data?.current?.id]);

  if (!data?.current) return (<><Header /><div className="container mx-auto p-8 text-center text-muted-foreground">Đang tải...</div></>);

  const nav = (
    <div className="flex items-center justify-center gap-2 flex-wrap py-4">
      <Button variant="outline" disabled={!data.prev} onClick={() => data.prev && navigate({ to: "/manga/$id/chapter/$num", params: { id, num: String(data.prev.chapter_number) } })}>
        <ChevronLeft className="size-4 mr-1" />Trước
      </Button>
      <Button asChild variant="secondary"><Link to="/manga/$id" params={{ id }}><List className="size-4 mr-1" />Danh sách</Link></Button>
      <Button variant="outline" disabled={!data.next} onClick={() => data.next && navigate({ to: "/manga/$id/chapter/$num", params: { id, num: String(data.next.chapter_number) } })}>
        Sau<ChevronRight className="size-4 ml-1" />
      </Button>
    </div>
  );

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-2">{data.manga?.title} — Chương {n}{data.current.title ? `: ${data.current.title}` : ""}</h1>
        {nav}
        <div className="max-w-3xl mx-auto space-y-1">
          {data.current.pages.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Chưa có trang nào.</p>
          ) : data.current.pages.map((p, i) => (
            <img key={i} src={p} alt={`Trang ${i + 1}`} loading="lazy" className="w-full" />
          ))}
        </div>
        {nav}
      </main>
    </>
  );
}

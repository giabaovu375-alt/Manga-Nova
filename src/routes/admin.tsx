import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, Upload, BookPlus } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

async function uploadFile(file: File, path: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const full = `${path}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("manga").upload(full, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from("manga").getPublicUrl(full).data.publicUrl;
}

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !isAdmin) return (<><Header /><div className="p-8 text-center text-muted-foreground">Đang kiểm tra quyền...</div></>);

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-8">
        <h1 className="text-2xl font-bold">Quản trị</h1>
        <NewMangaForm />
        <MangaList />
      </main>
    </>
  );
}

function NewMangaForm() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Nhập tiêu đề");
    setLoading(true);
    try {
      let cover_url: string | null = null;
      if (cover) cover_url = await uploadFile(cover, "covers");
      const { error } = await supabase.from("mangas").insert({ title: title.trim(), description: description.trim() || null, cover_url, featured });
      if (error) throw error;
      toast.success("Đã thêm truyện!");
      setTitle(""); setDescription(""); setCover(null); setFeatured(false);
      qc.invalidateQueries();
    } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><BookPlus className="size-4" />Thêm truyện mới</h2>
      <div><Label>Tiêu đề</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div><Label>Mô tả</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
      <div><Label>Ảnh bìa</Label><Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></div>
      <div className="flex items-center gap-2"><Switch checked={featured} onCheckedChange={setFeatured} /><Label>Nổi bật</Label></div>
      <Button type="submit" disabled={loading}><Plus className="size-4 mr-1" />{loading ? "Đang thêm..." : "Thêm truyện"}</Button>
    </form>
  );
}

function MangaList() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-mangas"],
    queryFn: async () => (await supabase.from("mangas").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const del = async (id: string) => {
    if (!confirm("Xoá truyện này?")) return;
    const { error } = await supabase.from("mangas").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Đã xoá"); qc.invalidateQueries(); }
  };

  return (
    <section>
      <h2 className="font-semibold mb-3">Danh sách truyện</h2>
      <div className="space-y-3">
        {(data ?? []).map((m) => (
          <div key={m.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start gap-4">
              {m.cover_url && <img src={m.cover_url} alt="" className="w-16 h-24 object-cover rounded" />}
              <div className="flex-1">
                <h3 className="font-semibold">{m.title}{m.featured && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Nổi bật</span>}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>
              </div>
              <Button size="icon" variant="destructive" onClick={() => del(m.id)}><Trash2 className="size-4" /></Button>
            </div>
            <ChapterManager mangaId={m.id} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ChapterManager({ mangaId }: { mangaId: string }) {
  const qc = useQueryClient();
  const { data: chapters } = useQuery({
    queryKey: ["admin-chapters", mangaId],
    queryFn: async () => (await supabase.from("chapters").select("*").eq("manga_id", mangaId).order("chapter_number")).data ?? [],
  });
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!num || !files || files.length === 0) return toast.error("Nhập số chương và chọn trang");
    setLoading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadFile(f, `pages/${mangaId}`));
      const { error } = await supabase.from("chapters").insert({ manga_id: mangaId, chapter_number: parseInt(num, 10), title: title.trim() || null, pages: urls });
      if (error) throw error;
      toast.success("Đã thêm chương!");
      setNum(""); setTitle(""); setFiles(null);
      qc.invalidateQueries({ queryKey: ["admin-chapters", mangaId] });
    } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };

  const delCh = async (id: string) => {
    if (!confirm("Xoá chương?")) return;
    await supabase.from("chapters").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-chapters", mangaId] });
  };

  return (
    <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
      <form onSubmit={add} className="grid sm:grid-cols-[100px_1fr_auto_auto] gap-2 items-end">
        <div><Label className="text-xs">Số chương</Label><Input type="number" min={1} value={num} onChange={(e) => setNum(e.target.value)} /></div>
        <div><Label className="text-xs">Tiêu đề (tuỳ chọn)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label className="text-xs">Các trang</Label><Input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} /></div>
        <Button type="submit" size="sm" disabled={loading}><Upload className="size-4 mr-1" />{loading ? "..." : "Thêm"}</Button>
      </form>
      {(chapters ?? []).length > 0 && (
        <ul className="text-sm space-y-1">
          {chapters!.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-1">
              <span>Ch.{c.chapter_number} • {c.pages.length} trang • {c.views} lượt xem</span>
              <Button size="icon" variant="ghost" onClick={() => delCh(c.id)}><Trash2 className="size-3" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

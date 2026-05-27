import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  BookPlus, X, Loader2, Trash2, Upload, Plus, ChevronDown, ChevronUp
} from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

// ==================== UPLOAD FILE (FIXED) ====================
async function uploadFile(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"; // fallback
  const fileName = `${folder}/${crypto.randomUUID()}.${ext || "jpg"}`;

  const { error } = await supabase.storage
    .from("manga")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("manga")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// ==================== ADMIN PAGE ====================
function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate({ to: "/" });
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin mr-2" />
          Đang kiểm tra quyền truy cập...
        </div>
      </>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Trang Quản Trị</h1>
            <p className="text-muted-foreground">Quản lý truyện tranh</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <NewMangaForm />
            </div>
            <div className="lg:col-span-7">
              <MangaList />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== FORM ====================
function NewMangaForm() {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cleanup object URL khi unmount
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke URL cũ nếu có
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(null);
    setCoverPreview(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Tiêu đề không được để trống");
      return;
    }
    setLoading(true);
    try {
      let cover_url: string | null = null;
      if (cover) {
        cover_url = await uploadFile(cover, "covers");
      }
      const { error } = await supabase.from("mangas").insert({
        title: title.trim(),
        description: description.trim() || null,
        cover_url,
        featured,
      });
      if (error) throw error;
      toast.success("Thêm truyện thành công!");
      setTitle("");
      setDescription("");
      setCover(null);
      setFeatured(false);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-mangas"] });
    } catch (err: any) {
      toast.error(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookPlus className="size-5" />
          Thêm Truyện Mới
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label>Tiêu đề *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div>
            <Label>Ảnh bìa</Label>
            <Input type="file" accept="image/*" onChange={handleCoverChange} />
            {coverPreview && (
              <div className="mt-3 relative inline-block">
                <img src={coverPreview} className="w-32 h-44 object-cover rounded-lg border" />
                <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2" onClick={removeCover}>
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={featured} onCheckedChange={setFeatured} />
            <Label>Truyện nổi bật</Label>
          </div>
          <Button disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            {loading ? "Đang xử lý..." : "Thêm Truyện"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ==================== MANGA LIST (React Query) ====================
function MangaList() {
  const { data: mangas = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-mangas"],
    queryFn: async () => {
      const { data } = await supabase.from("mangas").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const deleteManga = async (id: string, title: string) => {
    if (!confirm(`Xóa "${title}" và tất cả chương?`)) return;
    await supabase.from("mangas").delete().eq("id", id);
    toast.success("Đã xóa truyện");
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách truyện ({mangas.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mangas.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Chưa có truyện nào.</p>
        ) : (
          mangas.map((manga) => (
            <div key={manga.id} className="border rounded-lg">
              <div className="flex items-center gap-4 p-4">
                <img src={manga.cover_url} className="w-12 h-16 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{manga.title}</h3>
                  <p className="text-xs text-muted-foreground">{manga.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpandedId(expandedId === manga.id ? null : manga.id)}
                >
                  {expandedId === manga.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteManga(manga.id, manga.title)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              {expandedId === manga.id && (
                <div className="border-t p-4 bg-muted/50">
                  <ChapterManager mangaId={manga.id} />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ==================== CHAPTER MANAGER (cải tiến) ====================
function ChapterManager({ mangaId }: { mangaId: string }) {
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [chapterNum, setChapterNum] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [uploadingChapterId, setUploadingChapterId] = useState<string | null>(null);

  const fetchChapters = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("chapters")
        .select("*")
        .eq("manga_id", mangaId)
        .order("chapter_number");
      setChapters(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mangaId]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  const addChapter = async () => {
    if (!chapterNum) return;
    const num = parseInt(chapterNum);
    if (isNaN(num)) return;

    // Optimistic UI
    const tempId = crypto.randomUUID();
    setChapters((prev) => [
      ...prev,
      { id: tempId, chapter_number: num, title: chapterTitle, pages: [] },
    ]);

    const { error } = await supabase.from("chapters").insert({
      manga_id: mangaId,
      chapter_number: num,
      title: chapterTitle,
      pages: [],
    });
    if (error) {
      toast.error(error.message);
      setChapters((prev) => prev.filter((ch) => ch.id !== tempId)); // rollback
    } else {
      toast.success("Thêm chương thành công");
      setChapterNum("");
      setChapterTitle("");
      setShowAdd(false);
      fetchChapters(); // lấy dữ liệu thật từ server
    }
  };

  const deleteChapter = async (id: string, num: number) => {
    if (!confirm(`Xóa Chương ${num}?`)) return;
    await supabase.from("chapters").delete().eq("id", id);
    toast.success("Đã xóa chương");
    fetchChapters();
  };

  const uploadPages = async (chapterId: string, files: FileList) => {
    setUploadingChapterId(chapterId);
    try {
      // Upload song song tất cả file
      const urls = await Promise.all(
        Array.from(files).map((file) =>
          uploadFile(file, `chapters/${chapterId}`)
        )
      );
      // Lấy danh sách pages hiện tại và cập nhật
      const { data: currentChapter } = await supabase
        .from("chapters")
        .select("pages")
        .eq("id", chapterId)
        .single();
      const existingPages = currentChapter?.pages || [];
      const { error } = await supabase
        .from("chapters")
        .update({ pages: [...existingPages, ...urls] })
        .eq("id", chapterId);
      if (error) throw error;
      toast.success(`Đã thêm ${files.length} trang`);
      fetchChapters();
    } catch (err: any) {
      toast.error(err.message || "Lỗi upload trang");
    } finally {
      setUploadingChapterId(null);
    }
  };

  if (loading) return <Loader2 className="animate-spin mx-auto my-4" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Chương ({chapters.length})</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="size-3 mr-1" />
          Thêm Chương
        </Button>
      </div>

      {showAdd && (
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Số</Label>
            <Input type="number" value={chapterNum} onChange={(e) => setChapterNum(e.target.value)} className="h-8 w-20" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Tiêu đề</Label>
            <Input value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} className="h-8" />
          </div>
          <Button size="sm" onClick={addChapter}>Lưu</Button>
        </div>
      )}

      {chapters.map((ch) => (
        <div key={ch.id} className="flex items-center gap-3 bg-background p-3 rounded-lg border">
          <span className="text-sm font-medium w-16">Ch. {ch.chapter_number}</span>
          <span className="text-sm flex-1 truncate">{ch.title || "Không tiêu đề"}</span>
          <span className="text-xs text-muted-foreground">{ch.pages?.length || 0} trang</span>
          <div className="flex items-center gap-1">
            <label className="cursor-pointer">
              <div className="flex items-center gap-1 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors">
                <Upload className="size-3" />
                {uploadingChapterId === ch.id ? (
                  <Loader2 className="animate-spin size-3" />
                ) : (
                  "Upload"
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    uploadPages(ch.id, e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <Button variant="ghost" size="icon" onClick={() => deleteChapter(ch.id, ch.chapter_number)}>
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

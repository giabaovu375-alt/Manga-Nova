import { supabase } from "@/integrations/supabase/client";

export interface MangaWithStats {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  featured: boolean;
  created_at: string;
  avg: number;
  count: number;
}

async function attachStats(mangas: any[]): Promise<MangaWithStats[]> {
  if (!mangas.length) return [];
  const ids = mangas.map((m) => m.id);
  const { data: ratings } = await supabase.from("ratings").select("manga_id, stars").in("manga_id", ids);
  const stats: Record<string, { sum: number; n: number }> = {};
  (ratings ?? []).forEach((r: any) => {
    stats[r.manga_id] = stats[r.manga_id] || { sum: 0, n: 0 };
    stats[r.manga_id].sum += r.stars;
    stats[r.manga_id].n += 1;
  });
  return mangas.map((m) => {
    const s = stats[m.id];
    return { ...m, avg: s ? s.sum / s.n : 0, count: s?.n ?? 0 };
  });
}

export const PAGE_SIZE = 14;

export async function fetchMangaPage(page: number, query: string) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let qb = supabase.from("mangas").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (query.trim()) qb = qb.ilike("title", `%${query.trim()}%`);
  const { data, count } = await qb.range(from, to);
  return { items: await attachStats(data ?? []), total: count ?? 0 };
}

export async function fetchFeatured() {
  const { data } = await supabase.from("mangas").select("*").eq("featured", true).order("created_at", { ascending: false }).limit(8);
  return attachStats(data ?? []);
}

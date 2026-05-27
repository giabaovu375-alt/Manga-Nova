import { Link } from "@tanstack/react-router";
import { Star, ImageOff } from "lucide-react";

interface Props {
  id: string;
  title: string;
  cover_url: string | null;
  avg: number;
  count: number;
}

export function MangaCard({ id, title, cover_url, avg, count }: Props) {
  return (
    <Link
      to="/manga/$id"
      params={{ id }}
      className="group relative overflow-hidden rounded-xl bg-card border border-border/60 hover:border-primary/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/20"
    >
      <div className="relative aspect-[2/3] bg-muted overflow-hidden">
        {cover_url ? (
          <img src={cover_url} alt={title} loading="lazy" className="size-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground"><ImageOff /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent opacity-90" />
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-background/80 backdrop-blur-md text-xs flex items-center gap-1 font-semibold border border-border/50">
          <Star className="size-3 fill-[var(--star)] text-[var(--star)]" />
          {avg.toFixed(1)}
          <span className="text-muted-foreground font-normal">({count})</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors drop-shadow">{title}</h3>
        </div>
      </div>
    </Link>
  );
}

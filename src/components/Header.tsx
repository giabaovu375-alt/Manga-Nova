import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, BookOpen, LogOut, Shield, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/75 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-xl shrink-0 tracking-tight">
          <span className="grid place-items-center size-9 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
            <BookOpen className="size-5 text-primary-foreground" />
          </span>
          <span className="hidden sm:inline bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-transparent">MangaNova</span>
        </Link>
        <form onSubmit={(e) => { e.preventDefault(); navigate({ to: "/", search: { q, page: 1 } as any }); }}
          className="flex-1 max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm truyện tranh..." className="pl-9 bg-input/60" />
        </form>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
              <Link to="/admin"><Shield className="size-4 mr-1" />Admin</Link>
            </Button>
          )}
          {user ? (
            <Button size="sm" variant="ghost" onClick={() => signOut()}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline ml-1">Đăng xuất</span>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth"><User className="size-4 mr-1" />Đăng nhập</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

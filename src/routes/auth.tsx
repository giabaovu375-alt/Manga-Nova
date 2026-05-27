import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const signupSchema = z.object({
  username: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(40),
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl">
        <Link to="/" className="flex items-center justify-center gap-2 font-bold text-2xl mb-6">
          <BookOpen className="text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">MangaVerse</span>
        </Link>
        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">Đăng nhập</TabsTrigger>
            <TabsTrigger value="signup">Đăng ký</TabsTrigger>
          </TabsList>
          <TabsContent value="login"><LoginForm /></TabsContent>
          <TabsContent value="signup"><SignupForm /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Đăng nhập thành công!");
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-4">
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Mật khẩu</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Đang xử lý..." : "Đăng nhập"}</Button>
    </form>
  );
}

function SignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ username, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username }, emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Đăng ký thành công! Kiểm tra email để xác thực.");
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-4">
      <div><Label>Tên tài khoản</Label><Input required value={username} onChange={(e) => setUsername(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Mật khẩu</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Đang xử lý..." : "Đăng ký"}</Button>
    </form>
  );
}

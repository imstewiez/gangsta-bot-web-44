import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi desta.";
      // generic on purpose — no enumeration of accounts
      toast.error(msg.toLowerCase().includes("invalid") ? "Credenciais não batem certo." : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grain">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-10 flex items-center gap-3 self-start">
          <img src={(await import("@/assets/redwood-logo.png")).default} alt="" className="hidden" />
          <img src={new URL("@/assets/redwood-logo.png", import.meta.url).href} alt="RedWood" className="h-11 w-11 rounded-sm object-contain drop-shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_60%,transparent)]" />
          <span className="text-display text-sm tracking-[0.25em]">Firma RedWood</span>
        </Link>

        <div className="rounded-sm border border-border bg-card p-7 shadow-2xl">
          <div className="text-display text-[11px] tracking-[0.3em] text-primary mb-2">
            Porta da firma
          </div>
          <h1 className="mb-1 text-2xl font-bold">Diz quem és.</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Acesso só para quem já tem nome no bairro.
          </p>

          <form onSubmit={handle} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full text-display tracking-wider">
              {loading ? "A abrir…" : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Sem conta? Fala com a chefia. Não se cria sozinho.
        </p>
      </div>
    </div>
  );
}

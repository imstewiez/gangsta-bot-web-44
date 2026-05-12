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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              display_name: displayName || email.split("@")[0],
              provider_id: discordId || null,
            },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Entra abaixo.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grain">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-sm bg-primary font-display text-primary-foreground">R</div>
          <span className="text-display text-sm tracking-widest">Firma RedWood</span>
        </Link>

        <div className="rounded-sm border border-border bg-card p-6">
          <div className="text-display text-xs text-primary mb-1">{mode === "signin" ? "Entrar" : "Dar a cara"}</div>
          <h1 className="mb-6 text-2xl font-bold">
            {mode === "signin" ? "Bem-vindo ao bairro." : "Cria conta."}
          </h1>

          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="dn">Nome / alcunha</Label>
                  <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Stewiez" />
                </div>
                <div>
                  <Label htmlFor="did">Discord ID (opcional)</Label>
                  <Input id="did" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="123456789012345678" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Liga a tua conta ao membro existente no bairro.
                  </p>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full text-display">
              {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Sem conta? Criar uma" : "Já tens conta? Entrar"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Discord OAuth será adicionado quando configurares o app no painel da Cloud.
        </p>
      </div>
    </div>
  );
}

import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import redwoodLogo from "@/assets/redwood-logo.png";
import { CinematicBackdrop } from "@/components/layout/CinematicBackdrop";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (isServer()) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleDiscordLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      // OAuth redirect happens automatically — no navigation needed
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi desta.";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="ambient-bg relative min-h-screen overflow-hidden">
      <CinematicBackdrop />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link
          to="/"
          className="mb-10 flex items-center gap-3 self-start animate-rise"
        >
          <img
            src={redwoodLogo}
            alt="RedWood"
            className="h-11 w-11 rounded-sm object-contain drop-shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
          />
          <span className="text-display text-sm tracking-[0.25em]">
            RedWood
          </span>
        </Link>

        <div className="card-frame rounded-xl p-7 animate-rise delay-100">
          <div className="text-display text-[11px] tracking-[0.3em] text-primary mb-2">
            Porta da firma
          </div>
          <h1 className="mb-1 text-display text-3xl font-bold text-glow">
            Diz quem és.
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Acesso só para quem já tem nome no bairro.
          </p>

          <Button
            disabled={loading}
            onClick={handleDiscordLogin}
            className="btn-shine w-full gap-2 text-display tracking-wider"
          >
            <DiscordIcon className="h-4 w-4" />
            {loading ? "A abrir…" : "Entrar com Discord"}
          </Button>
        </div>

        <p className="mt-6 text-center text-xs uppercase tracking-[0.24em] text-muted-foreground/60">
          Sem conta? Fala com a chefia no Discord.
        </p>
      </div>
    </div>
  );
}

function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

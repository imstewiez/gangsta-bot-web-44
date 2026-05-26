import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ballasLogo from "@/assets/ballas-logo.png";
import { CinematicBackdrop } from "@/components/layout/CinematicBackdrop";
import { ShieldCheck } from "lucide-react";

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
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo correu mal.";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="ambient-bg relative min-h-screen overflow-hidden">
      <CinematicBackdrop />

      {/* Corner marks */}
      <CornerMarks />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <div className="reveal text-center">
          <div className="relative inline-block">
            <span className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-3xl scale-150" />
            <img
              src={ballasLogo}
              alt="Ballas Gang"
              draggable={false}
              className="logo-hd h-28 w-28 mx-auto object-contain select-none"
            />
          </div>

          <div className="mt-6 text-display text-[10px] tracking-[0.5em] text-primary/80 uppercase">
            Ballas · Gang
          </div>
          <h1 className="mt-2 text-display text-2xl md:text-3xl font-bold tracking-tight text-glow">
            Acesso reservado
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Entra com Discord. Só membros aprovados passam a porta.
          </p>
        </div>

        <div className="reveal mt-10 w-full">
          <Button
            disabled={loading}
            onClick={handleDiscordLogin}
            className="btn-shine w-full gap-2 text-display tracking-[0.18em] h-12 bg-gradient-to-b from-primary to-blood hover:brightness-110 transition-all cursor-pointer"
          >
            <DiscordIcon className="h-4 w-4" />
            {loading ? "A abrir Discord…" : "Entrar com Discord"}
          </Button>

          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground/60">
            <ShieldCheck className="h-3 w-3" />
            Sessão segura · canal encriptado
          </div>
        </div>
      </div>
    </div>
  );
}

function CornerMarks() {
  const base = "pointer-events-none fixed h-8 w-8 border-primary/30 z-40";
  return (
    <>
      <div className={`${base} top-4 left-4 border-l border-t`} />
      <div className={`${base} top-4 right-4 border-r border-t`} />
      <div className={`${base} bottom-4 left-4 border-l border-b`} />
      <div className={`${base} bottom-4 right-4 border-r border-b`} />
    </>
  );
}

function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

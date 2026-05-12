import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase automatically processes the #access_token hash
      // when getSession() is called. We just need to wait a tick.
      await new Promise((r) => setTimeout(r, 100));

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setError("Falha na autenticação. Tenta novamente.");
        return;
      }

      // Session is valid — redirect to dashboard
      throw redirect({ to: "/dashboard" });
    };

    handleCallback();
  }, []);

  if (error) {
    return (
      <div className="ambient-bg flex min-h-screen items-center justify-center">
        <div className="card-frame rounded-xl p-8 text-center">
          <h1 className="text-display text-xl text-destructive mb-2">Erro</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-bg flex min-h-screen items-center justify-center">
      <div className="card-frame rounded-xl p-8 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-display text-sm text-muted-foreground">
          A autenticar…
        </p>
      </div>
    </div>
  );
}

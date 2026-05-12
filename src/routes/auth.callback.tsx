import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const search = useSearch({ from: "/auth/callback" });

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase v2 uses PKCE: the callback has ?code=... in the query string
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription = url.searchParams.get("error_description");

      if (errorDescription) {
        setError(errorDescription);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      }

      // Verify session was created
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        setError("Falha na autenticação. Tenta novamente.");
        return;
      }

      // Success — redirect to dashboard
      window.location.href = "/dashboard";
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

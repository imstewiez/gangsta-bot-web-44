import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";

/** Fallback quando uma página crasha. Não quebra a app toda. */
export function PageErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center animate-rise">
      <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
        <AlertTriangle className="h-7 w-7 text-destructive" />
        <span className="absolute inset-0 rounded-full bg-destructive/10 blur-xl" />
      </div>
      <h2 className="text-display text-lg tracking-wide">Algo correu mal</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {error.message || "Não conseguimos carregar esta página. Tenta outra vez."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {reset && (
          <Button size="sm" onClick={reset} className="btn-shine">
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Tentar de novo
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => router.navigate({ to: "/dashboard" })}>
          <Home className="mr-1.5 h-4 w-4" />
          Dashboard
        </Button>
      </div>
    </div>
  );
}

import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { ERROR_PAGE } from "@/lib/messages";

/** Fallback quando uma página crasha. Não quebra a app toda. */
export function PageErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset?: () => void;
}) {
  const router = useRouter();
  // Never show raw error.message to end users
  const displayMessage = ERROR_PAGE.genericDescription;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center animate-rise">
      <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
        <AlertTriangle className="h-9 w-9 text-destructive" />
        <span className="absolute inset-0 rounded-full bg-destructive/10 blur-xl animate-pulse" />
      </div>
      <h2 className="text-display text-xl font-bold tracking-wide">{ERROR_PAGE.genericTitle}</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {displayMessage}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {reset && (
          <Button size="sm" onClick={reset} className="btn-shine">
            <RotateCcw className="mr-1.5 h-4 w-4" />
            {ERROR_PAGE.genericButton}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => router.navigate({ to: "/dashboard" })}>
          <Home className="mr-1.5 h-4 w-4" />
          {ERROR_PAGE.notFoundButton}
        </Button>
      </div>
    </div>
  );
}

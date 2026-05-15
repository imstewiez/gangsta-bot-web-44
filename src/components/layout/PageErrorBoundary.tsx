import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";

/** Fallback bonito quando uma página crasha. Não quebra a app toda. */
export function PageErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-display text-lg">Algo correu mal</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {error.message || "Não conseguimos carregar esta página."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {reset && (
          <Button size="sm" onClick={reset}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Tentar de novo
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => router.navigate({ to: "/" })}>
          <Home className="mr-1 h-4 w-4" />
          Início
        </Button>
      </div>
    </div>
  );
}

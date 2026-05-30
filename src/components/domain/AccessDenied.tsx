import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { ACCESS_DENIED } from "@/lib/messages";

interface AccessDeniedProps {
  title?: string;
  description?: string;
}

export function AccessDenied({
  title = ACCESS_DENIED.title,
  description = ACCESS_DENIED.description,
}: AccessDeniedProps) {
  const router = useRouter();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center animate-rise">
      <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
        <ShieldOff className="h-9 w-9 text-destructive" />
        <span className="absolute inset-0 rounded-full bg-destructive/10 blur-xl animate-pulse" />
      </div>
      <h2 className="text-display text-xl font-bold tracking-wide">{title}</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-6"
        onClick={() => router.navigate({ to: "/dashboard" })}
      >
        {ACCESS_DENIED.button}
      </Button>
    </div>
  );
}

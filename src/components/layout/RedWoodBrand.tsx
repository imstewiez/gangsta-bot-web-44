import { cn } from "@/lib/utils";

interface RedWoodBrandProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

// Mantém o nome do export por retro-compat, mas a marca é Ballas Gang.
export function RedWoodBrand({ className, size = "md", showTagline = false }: RedWoodBrandProps) {
  const sizes = {
    sm: { firma: "text-sm", red: "text-sm", tag: "text-[10px]" },
    md: { firma: "text-base", red: "text-base", tag: "text-xs" },
    lg: { firma: "text-xl", red: "text-xl", tag: "text-sm" },
  };
  const s = sizes[size];

  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <div className="flex items-baseline gap-1">
        <span className={cn("font-medium tracking-tight text-foreground", s.firma)}>
          Ballas
        </span>
        <span
          className={cn("font-bold tracking-tight bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent", s.red)}
        >
          Gang
        </span>
      </div>
      {showTagline && (
        <span className={cn("tracking-[0.25em] uppercase text-muted-foreground/70 mt-0.5 font-display", s.tag)}>
          Sangue · Roxo · Bairro
        </span>
      )}
    </div>
  );
}

export function RedWoodTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-bold bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent", className)}>
      {children}
    </span>
  );
}

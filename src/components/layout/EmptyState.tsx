import { type LucideIcon } from "lucide-react";

/** Estado vazio com estilo temático Ballas Gang. */
export function EmptyState({
  icon: Icon,
  title = "Nada por aqui",
  description = "Ainda não há nada para mostrar.",
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center animate-rise">
      <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/30">
        {Icon ? (
          <Icon className="h-5 w-5 text-primary/80" />
        ) : (
          <span className="text-lg">∅</span>
        )}
        <span className="absolute inset-0 rounded-full bg-primary/10 blur-lg" />
      </div>
      <h3 className="text-display text-sm tracking-wider">{title}</h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

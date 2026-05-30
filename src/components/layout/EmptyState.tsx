import { type LucideIcon } from "lucide-react";

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
    <div className="col-span-full text-center py-12">
      {Icon && <Icon className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

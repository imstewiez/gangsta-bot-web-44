import { PackageOpen, type LucideIcon } from "lucide-react";

/** Estado vazio bonito para listas sem dados. */
export function EmptyState({
  icon: Icon = PackageOpen,
  title = "Nada por aqui",
  description = "Ainda não há nada para mostrar.",
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-display text-sm">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

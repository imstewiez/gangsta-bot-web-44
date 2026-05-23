import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/domain/ItemIcon";
import { ARMORY_CAT_CONFIG } from "@/lib/armory.catalog";
import { inferCategory } from "@/components/domain/ItemIcon";
import type { ReactNode } from "react";

export function CategoryHeader({
  category,
  label,
  right,
  className,
}: {
  category: string;
  label?: string;
  right?: ReactNode;
  className?: string;
}) {
  // Se a categoria não é uma chave directa do ARMORY_CAT_CONFIG,
  // tentamos inferir a partir do nome/texto.
  const catKey =
    (category as keyof typeof ARMORY_CAT_CONFIG) in ARMORY_CAT_CONFIG
      ? category
      : inferCategory(category, category);

  const cfg = ARMORY_CAT_CONFIG[catKey as keyof typeof ARMORY_CAT_CONFIG];
  const displayLabel = label ?? cfg?.label ?? category;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-4 py-2.5",
        cfg?.bg ?? "bg-muted/40",
        cfg?.border ?? "border-border",
        cfg?.headerColor ?? "text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <CategoryIcon category={catKey} size={18} />
        <span className="text-display text-sm uppercase tracking-widest">
          {displayLabel}
        </span>
      </div>
      {right && (
        <span className="text-display text-[11px] tracking-wider opacity-90">
          {right}
        </span>
      )}
    </div>
  );
}

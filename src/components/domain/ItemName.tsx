import { ItemIcon } from "@/components/domain/ItemIcon";

interface ItemNameProps {
  name: string;
  category?: string | null;
  size?: number;
  showIcon?: boolean;
}

export function ItemName({ name, category, size, showIcon = true }: ItemNameProps) {
  return (
    <span className="inline-flex items-center gap-2">
      {showIcon && <ItemIcon name={name} category={category} size={size ?? 14} />}
      {name}
    </span>
  );
}

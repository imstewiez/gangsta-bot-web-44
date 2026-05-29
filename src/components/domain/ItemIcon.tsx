import {
  Zap,
  Flame,
  Skull,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  ARMORY_CAT_CONFIG,
  type ArmoryCategory,
} from "@/lib/armory.catalog";

// Re-export CatKey for backwards compat
export type CatKey = ArmoryCategory;

// Build maps from the single source of truth
export const CATEGORY_ICON: Record<CatKey, LucideIcon> = Object.fromEntries(
  Object.entries(ARMORY_CAT_CONFIG).map(([k, v]) => [k, v.icon]),
) as Record<CatKey, LucideIcon>;

export const CATEGORY_TONE: Record<CatKey, string> = Object.fromEntries(
  Object.entries(ARMORY_CAT_CONFIG).map(([k, v]) => [k, v.tone]),
) as Record<CatKey, string>;

// Pequenos overrides muito específicos
const NAME_OVERRIDE: Array<[RegExp, LucideIcon]> = [
  [/\bcobre\b/, Zap],
  [/p[oó]lvora|gunpowder/, Flame],
  [/morto|cad[aá]ver|corpo\s*humano/, Skull],
];

// Categorias válidas no sistema atual
const VALID_CATEGORIES = new Set(Object.keys(ARMORY_CAT_CONFIG));

export function inferCategory(name: string, raw?: string | null): CatKey {
  const n = (name ?? "").toLowerCase();
  const c = (raw ?? "").toLowerCase();

  if (c && VALID_CATEGORIES.has(c)) return c as CatKey;

  if (/colete|kevlar|vest|armor/.test(n)) return "coletes";
  if (/carregador|magazine|\bmag\b/.test(n)) return "carregadores";
  if (
    /silenciador|supressor|mira|red\s*dot|holo|scope|telesc|lanterna|flash|punho|grip|coronha|cano|barrel/.test(n)
  )
    return "acessorios";
  // Armas Red
  if (
    /heavy pistol|\.50|pdw|p90|bullpup|carabina/.test(n)
  )
    return "armas_red";
  // Armas Orange
  if (
    /mini smg|pistol xm3|micro smg|tec\s*9|tec[-\s]9|tec pistol|ap pistol|compact rifle/.test(n)
  )
    return "armas_orange";
  if (/print|esquema|blueprint/.test(n)) return "prints";
  if (/corpo|chassi/.test(n)) return "corpos";

  return "outros";
}

export function pickItemIcon(name: string, category?: string | null): LucideIcon {
  const n = (name ?? "").toLowerCase();
  for (const [re, ic] of NAME_OVERRIDE) if (re.test(n)) return ic;
  const cat = inferCategory(name, category ?? undefined);
  return CATEGORY_ICON[cat] ?? Package;
}

// Classes Tailwind por tom — texto + bg + border do "puck" do ícone.
const TONE_TEXT: Record<string, string> = {
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  primary: "text-primary",
  success: "text-success",
  muted: "text-muted-foreground",
  orange: "text-orange-400",
};

const TONE_PUCK: Record<string, string> = {
  warning: "bg-warning/15 ring-1 ring-inset ring-warning/30 text-warning",
  destructive:
    "bg-destructive/15 ring-1 ring-inset ring-destructive/30 text-destructive",
  info: "bg-info/15 ring-1 ring-inset ring-info/30 text-info",
  primary: "bg-primary/15 ring-1 ring-inset ring-primary/30 text-primary",
  success: "bg-success/15 ring-1 ring-inset ring-success/30 text-success",
  muted: "bg-muted/40 ring-1 ring-inset ring-border text-muted-foreground",
  orange: "bg-orange-500/15 ring-1 ring-inset ring-orange-500/30 text-orange-400",
};

// Header de categoria — "puck" arredondado e colorido.
export function CategoryIcon({
  category,
  tone,
  size = 18,
}: {
  category: string;
  tone?: string;
  size?: number;
}) {
  const key =
    (category as CatKey) in CATEGORY_ICON ? (category as CatKey) : "outros";
  const Icon = CATEGORY_ICON[key];
  const cfg = ARMORY_CAT_CONFIG[key];
  const t = tone ?? cfg?.tone ?? CATEGORY_TONE[key] ?? "muted";
  const puck = TONE_PUCK[t] ?? TONE_PUCK.muted;
  const padding = size <= 14 ? "p-1" : size <= 18 ? "p-1.5" : "p-2";
  return (
    <span
      className={
        "inline-grid place-items-center rounded-md " + puck + " " + padding
      }
    >
      <Icon width={size} height={size} />
    </span>
  );
}

// Ícone inline para linhas — colorido pelo tom da categoria.
export function ItemIcon({
  name,
  category,
  size = 14,
  withPuck = false,
  className = "",
}: {
  name: string;
  category?: string | null;
  size?: number;
  withPuck?: boolean;
  className?: string;
}) {
  const Icon = pickItemIcon(name, category);
  const cat = inferCategory(name, category ?? undefined);
  const displayCat = (category ?? cat) as keyof typeof ARMORY_CAT_CONFIG;
  const cfg = ARMORY_CAT_CONFIG[displayCat in ARMORY_CAT_CONFIG ? displayCat : (cat as keyof typeof ARMORY_CAT_CONFIG)];
  let tone = cfg?.tone ?? CATEGORY_TONE[cat] ?? "muted";

  const n = name.toLowerCase();

  // Cores específicas para prints — por tier
  if (cat === "prints" || /print|esquema|blueprint/.test(n)) {
    if (n.includes("laranja") || n.includes("orange")) tone = "orange";
    else if (n.includes("vermelha") || n.includes("red")) tone = "destructive";
    else if (n.includes("azul") || n.includes("blue")) tone = "info";
    else if (n.includes("amarela") || n.includes("yellow")) tone = "warning";
    else tone = "destructive"; // default: red
  }

  // Corpos — red
  if (cat === "corpos" || /corpo|chassi/.test(n)) {
    tone = "destructive";
  }

  // Cores específicas para carregadores — usar displayCat também
  if (displayCat === "carregadores_orange" || displayCat === "carregadores_red" || displayCat === "carregadores_especial" || cat === "carregadores" || n.includes("carregador")) {
    if (displayCat === "carregadores_orange" || n.includes("orange")) tone = "orange";
    else if (displayCat === "carregadores_red" || n.includes("red")) tone = "destructive";
    else if (displayCat === "carregadores_especial" || n.includes("especial")) tone = "warning";
    else tone = "destructive"; // default
  }

  if (withPuck) {
    const puck = TONE_PUCK[tone] ?? TONE_PUCK.muted;
    return (
      <span
        className={
          "inline-grid place-items-center rounded-md p-1 " +
          puck +
          " " +
          className
        }
      >
        <Icon width={size} height={size} />
      </span>
    );
  }
  const color = TONE_TEXT[tone] ?? "text-muted-foreground";
  return (
    <Icon
      width={size}
      height={size}
      className={"shrink-0 " + color + " " + className}
    />
  );
}

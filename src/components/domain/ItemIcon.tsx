import {
  Zap,
  Flame,
  Skull,
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

export function inferCategory(name: string, raw?: string | null): CatKey {
  const n = (name ?? "").toLowerCase();
  const c = (raw ?? "").toLowerCase();

  if (c && (CATEGORY_ICON as Record<string, LucideIcon>)[c]) return c as CatKey;

  if (
    /coca|metanfet|meta\b|crystal|erva|maconha|haxixe|haxix|ecstasy|mdma|lsd|heroina|opio|ópio/.test(n)
  )
    return "drogas";
  if (/colete|kevlar|vest|armor/.test(n)) return "coletes";
  if (/carregador|magazine|\bmag\b/.test(n)) return "carregadores";
  if (
    /silenciador|supressor|mira|red\s*dot|holo|scope|telesc|lanterna|flash|punho|grip|coronha|cano|barrel/.test(n)
  )
    return "acessorios_armas";
  if (
    /faca|machete|katana|punh[aã]l|navalha|estilete|taco|cassetete|martelo|p[eé]-de-cabra|barra/.test(n)
  )
    return "armas_brancas";
  if (
    /sniper|fuzil|awp|barrett|kar98|ak\b|m4|g36|scar|fal|hk|aug|famas|shotgun|ca[çc]adeira|spas/.test(n)
  )
    return "armas_red";
  if (
    /pistola|glock|deagle|desert|colt|revolver|revólver|beretta|usp|uzi|mp5|mp7|smg|p90|vector/.test(n)
  )
    return "armas_orange";
  if (/print|esquema|blueprint/.test(n)) return "prints";
  if (/corpo|chassi/.test(n)) return "corpos";
  if (/madeira|tronco|tora|pinho|carvalho/.test(n)) return "madeiras";
  if (/min[ée]rio|pedra|cristal|cobre|ferro|a[çc]o|metal|ouro|prata/.test(n))
    return "minerios";
  if (/lixo|sucata|trash|chatarra/.test(n)) return "lixo";
  if (/\bpe[çc]as\b/.test(n)) return "materiais_craft";
  if (/\bpe[çc]a\b/.test(n)) return "craft_armas";
  if (/\bp[oó]lvora\b/.test(n)) return "materiais_craft";

  return "outros";
}

export function pickItemIcon(name: string, category?: string | null): LucideIcon {
  const n = (name ?? "").toLowerCase();
  for (const [re, ic] of NAME_OVERRIDE) if (re.test(n)) return ic;
  const cat = inferCategory(name, category ?? undefined);
  return CATEGORY_ICON[cat];
}

// Classes Tailwind por tom — texto + bg + border do "puck" do ícone.
const TONE_TEXT: Record<string, string> = {
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  primary: "text-primary",
  success: "text-success",
  muted: "text-muted-foreground",
};

const TONE_PUCK: Record<string, string> = {
  warning: "bg-warning/15 ring-1 ring-inset ring-warning/30 text-warning",
  destructive:
    "bg-destructive/15 ring-1 ring-inset ring-destructive/30 text-destructive",
  info: "bg-info/15 ring-1 ring-inset ring-info/30 text-info",
  primary: "bg-primary/15 ring-1 ring-inset ring-primary/30 text-primary",
  success: "bg-success/15 ring-1 ring-inset ring-success/30 text-success",
  muted: "bg-muted/40 ring-1 ring-inset ring-border text-muted-foreground",
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
  const cfg = ARMORY_CAT_CONFIG[cat];
  let tone = cfg?.tone ?? CATEGORY_TONE[cat] ?? "muted";

  // Cores específicas para prints
  const n = name.toLowerCase();
  if (n.includes("amarela")) tone = "warning";
  else if (n.includes("azul")) tone = "info";
  else if (n.includes("vermelha")) tone = "destructive";
  else if (n.includes("laranja")) tone = "primary";

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

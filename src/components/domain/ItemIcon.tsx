import {
  Crosshair,
  Swords,
  Sword,
  Package,
  Shield,
  Pill,
  Hammer,
  FlaskConical,
  Telescope,
  Cylinder,
  Zap,
  Flame,
  Pickaxe,
  Trees,
  Recycle,
  Box,
  Layers,
  Skull,
  Cog,
  type LucideIcon,
} from "lucide-react";

// =============================================================
// Uma categoria → um ícone → uma cor. Tudo uniforme.
// =============================================================

export type CatKey =
  | "armas_red"
  | "armas_orange"
  | "armas_brancas"
  | "carregadores"
  | "acessorios_armas"
  | "acessorios"
  | "coletes"
  | "drogas"
  | "craft_armas"
  | "craft_carregadores"
  | "materiais_craft"
  | "lixo"
  | "madeiras"
  | "materias_primas"
  | "minerios"
  | "corpos"
  | "prints"
  | "outros";

export const CATEGORY_ICON: Record<CatKey, LucideIcon> = {
  armas_red: Crosshair,
  armas_orange: Swords,
  armas_brancas: Sword,
  carregadores: Cylinder,
  acessorios_armas: Telescope,
  acessorios: Telescope,
  coletes: Shield,
  drogas: Pill,
  craft_armas: Hammer,
  craft_carregadores: FlaskConical,
  materiais_craft: Cog,
  lixo: Recycle,
  madeiras: Trees,
  materias_primas: Cog,
  minerios: Pickaxe,
  corpos: Box,
  prints: Layers,
  outros: Package,
};

// Tom de cor coerente com o resto do design system.
export const CATEGORY_TONE: Record<CatKey, string> = {
  armas_red: "destructive",
  armas_orange: "warning",
  armas_brancas: "info",
  carregadores: "primary",
  acessorios_armas: "info",
  acessorios: "info",
  coletes: "warning",
  drogas: "success",
  craft_armas: "primary",
  craft_carregadores: "muted",
  materiais_craft: "muted",
  lixo: "muted",
  madeiras: "success",
  materias_primas: "primary",
  minerios: "info",
  corpos: "warning",
  prints: "primary",
  outros: "muted",
};

// Pequenos overrides muito específicos (mais "fofo" para drogas e materiais raros).
const NAME_OVERRIDE: Array<[RegExp, LucideIcon]> = [
  [/\bcobre\b/, Zap],
  [/p[oó]lvora|gunpowder/, Flame],
  [/morto|cad[aá]ver|corpo\s*humano/, Skull],
];

// Inferir categoria a partir do nome quando não vem do servidor.
export function inferCategory(name: string, raw?: string | null): CatKey {
  const n = (name ?? "").toLowerCase();
  const c = (raw ?? "").toLowerCase();

  if (c && (CATEGORY_ICON as Record<string, LucideIcon>)[c]) return c as CatKey;

  if (
    /coca|metanfet|meta\b|crystal|erva|maconha|haxixe|haxix|ecstasy|mdma|lsd|heroina|opio|ópio/.test(
      n,
    )
  )
    return "drogas";
  if (/colete|kevlar|vest|armor/.test(n)) return "coletes";
  if (/carregador|magazine|\bmag\b/.test(n)) return "carregadores";
  if (
    /silenciador|supressor|mira|red\s*dot|holo|scope|telesc|lanterna|flash|punho|grip|coronha|cano|barrel/.test(
      n,
    )
  )
    return "acessorios_armas";
  if (
    /faca|machete|katana|punh[aã]l|navalha|estilete|taco|cassetete|martelo|p[eé]-de-cabra|barra/.test(
      n,
    )
  )
    return "armas_brancas";
  if (
    /sniper|fuzil|awp|barrett|kar98|ak\b|m4|g36|scar|fal|hk|aug|famas|shotgun|ca[çc]adeira|spas/.test(
      n,
    )
  )
    return "armas_red";
  if (
    /pistola|glock|deagle|desert|colt|revolver|revólver|beretta|usp|uzi|mp5|mp7|smg|p90|vector/.test(
      n,
    )
  )
    return "armas_orange";
  if (/print|esquema|blueprint/.test(n)) return "prints";
  if (/corpo|chassi/.test(n)) return "corpos";
  if (/madeira|tronco|tora|pinho|carvalho/.test(n)) return "madeiras";
  if (/min[ée]rio|pedra|cristal|cobre|ferro|a[çc]o|metal|ouro|prata/.test(n))
    return "minerios";
  if (/lixo|sucata|trash|chatarra/.test(n)) return "lixo";
  if (/pe[çc]a/.test(n)) return "craft_armas";
  if (/p[oó]lvora|gunpowder/.test(n)) return "craft_carregadores";

  return "outros";
}

export function pickItemIcon(
  name: string,
  category?: string | null,
): LucideIcon {
  const n = (name ?? "").toLowerCase();
  for (const [re, ic] of NAME_OVERRIDE) if (re.test(n)) return ic;
  const cat = inferCategory(name, category ?? undefined);
  return CATEGORY_ICON[cat];
}

// Cores específicas para prints
function pickPrintTone(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("amarela")) return "warning";
  if (n.includes("azul")) return "info";
  if (n.includes("vermelha")) return "destructive";
  if (n.includes("laranja")) return "primary";
  return null;
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
  const t = tone ?? CATEGORY_TONE[key] ?? "muted";
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
  let tone = CATEGORY_TONE[cat] ?? "muted";
  const printTone = pickPrintTone(name);
  if (printTone) tone = printTone;
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

import {
  Crosshair, Swords, Sword, Package, Wrench, Shield, Pill, Hammer, FlaskConical,
  Crown, Target, Flashlight, Telescope, Cog, Cylinder, Box, Layers, Zap, Flame, Pickaxe,
  Trees, Recycle, Gem, Leaf, Cigarette, Syringe, Cookie, Skull, Bomb, Anchor, Drill,
  type LucideIcon,
} from "lucide-react";

const Knife = Sword;
const Scope = Telescope;

// Per-category icon (for headers).
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  armas_red: Crosshair,
  armas_orange: Swords,
  armas_brancas: Knife,
  carregadores: Cylinder,
  acessorios_armas: Scope,
  coletes: Shield,
  drogas: Pill,
  craft_armas: Hammer,
  craft_carregadores: FlaskConical,
  outros: Package,
};

// Match an item by name/category to a lucide icon.
// Mantém-se compacto — fallback final é Package.
export function pickItemIcon(name: string, category?: string | null): LucideIcon {
  const n = (name ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();

  // Drogas individuais
  if (/coca|cocaina|cocaína/.test(n)) return Cookie;
  if (/meta|metanfet|crystal/.test(n)) return Gem;
  if (/erva|maconha|cannabis|haxixe|haxix/.test(n)) return Leaf;
  if (/ecstasy|mdma|lsd|comprim/.test(n)) return Pill;
  if (/heroina|heroína|opio|ópio/.test(n)) return Syringe;
  if (/cigarro|tabaco/.test(n)) return Cigarette;

  // Armas brancas
  if (/faca|machete|katana|punh[aã]l|navalha|estilete/.test(n)) return Knife;
  if (/taco|cassetete|martelo|p[eé]-de-cabra|barra/.test(n)) return Hammer;

  // Armas red (assault, sniper, shotgun, etc)
  if (/sniper|fuzil|awp|barrett|kar98/.test(n)) return Target;
  if (/ak|m4|g36|scar|fal|hk|aug|famas/.test(n)) return Crosshair;
  if (/shotgun|ca[çc]adeira|spas/.test(n)) return Crosshair;

  // Armas orange (pistolas, smgs)
  if (/pistola|glock|deagle|desert|colt|revolver|revólver|beretta|usp|pm|22\b/.test(n)) return Crosshair;
  if (/uzi|mp5|mp7|smg|p90|vector/.test(n)) return Crosshair;

  // Acessórios
  if (/silenciador|supressor/.test(n)) return Cylinder;
  if (/mira|red\s*dot|holo|scope|telesc/.test(n)) return Scope;
  if (/lanterna|flash/.test(n)) return Flashlight;
  if (/punho|grip|coronha|cano|barrel/.test(n)) return Cog;

  // Carregadores
  if (/carregador|magazine|\bmag\b/.test(n)) return Cylinder;

  // Coletes
  if (/colete|kevlar|vest|armor/.test(n)) return Shield;

  // Craft armas
  if (/pe[çc]a/.test(n)) return Cog;
  if (/corpo/.test(n)) return Box;
  if (/ferro|a[çc]o|metal/.test(n)) return Anchor;
  if (/print|esquema|blueprint/.test(n)) return Layers;

  // Craft carregadores
  if (/cobre/.test(n)) return Zap;
  if (/p[oó]lvora|gunpowder/.test(n)) return Flame;

  // Materiais genéricos
  if (/madeira|tronco|tora/.test(n)) return Trees;
  if (/min[ée]rio|min[ée]rios|pedra|cristal/.test(n)) return Pickaxe;
  if (/lixo|sucata|trash/.test(n)) return Recycle;
  if (/bomba|c4|explosi/.test(n)) return Bomb;
  if (/broca|drill/.test(n)) return Drill;
  if (/coroa|king/.test(n)) return Crown;
  if (/morto|cad[aá]ver|corpo\s*humano/.test(n)) return Skull;

  // Categoria fallback
  if (c === "drogas") return Pill;
  if (c === "armas" || c === "armas_fogo") return Crosshair;
  if (c === "armas_brancas") return Knife;
  if (c === "municoes" || c === "municao") return Cylinder;
  if (c === "acessorios") return Scope;
  if (c === "coletes") return Shield;
  if (c.startsWith("craft")) return Hammer;

  return Wrench;
}

const TONE_TEXT: Record<string, string> = {
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  primary: "text-primary",
  success: "text-success",
  muted: "text-muted-foreground",
};

export function CategoryIcon({
  category,
  tone = "muted",
  size = 16,
}: { category: string; tone?: string; size?: number }) {
  const Icon = CATEGORY_ICON[category] ?? Package;
  return <Icon width={size} height={size} className={TONE_TEXT[tone] ?? ""} />;
}

export function ItemIcon({
  name,
  category,
  size = 14,
  className = "",
}: { name: string; category?: string | null; size?: number; className?: string }) {
  const Icon = pickItemIcon(name, category ?? undefined);
  return <Icon width={size} height={size} className={"shrink-0 text-muted-foreground " + className} />;
}

import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Crosshair, Truck, ShoppingBag, Users, Package, type LucideIcon } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getCurrentMember } from "@/lib/pricing.functions";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type SearchPage = { label: string; path: string; icon: LucideIcon | null; admin?: boolean; adminOnly?: boolean };

const PAGES: SearchPage[] = [
  { label: "Casa", path: "/dashboard", icon: null },
  { label: "Inventário", path: "/inventario", icon: Package },
  { label: "Preçário", path: "/precario", icon: ShoppingBag },
  { label: "Receitas", path: "/receitas", icon: null },
  { label: "Encomendas", path: "/encomendas", icon: ShoppingBag },
  { label: "Entregas", path: "/entregas", icon: Truck },
  { label: "Saídas", path: "/operacoes", icon: Crosshair },
  { label: "Membros", path: "/membros", icon: Users },
  { label: "Classificação", path: "/tops", icon: null },
  { label: "Prémios", path: "/premios", icon: null },
  { label: "Auditoria", path: "/auditoria", icon: null, admin: true },
  { label: "Definições", path: "/admin", icon: null, admin: true, adminOnly: true },
];

const ACTIONS = [
  { label: "Nova saída", path: "/operacoes", icon: Crosshair, keywords: "operacao saida criar" },
  { label: "Entrega de stock", path: "/entregas", icon: Truck, keywords: "entrega material stock" },
  { label: "Nova encomenda", path: "/encomendas", icon: ShoppingBag, keywords: "pedido compra encomendar" },
  { label: "Ver membros", path: "/membros", icon: Users, keywords: "membro operacional" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 60_000 });
  const pages = PAGES.filter((page) => {
    if (page.admin && !(me.data?.is_manager ?? false)) return false;
    if (page.adminOnly && !(me.data?.is_admin || me.data?.is_superadmin)) return false;
    return true;
  });

  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      handler: () => setOpen((o) => !o),
      preventDefault: true,
    },
    {
      key: "Escape",
      handler: () => setOpen(false),
      preventDefault: false,
    },
  ]);

  const runCommand = useCallback(
    (path: string) => {
      setOpen(false);
      navigate({ to: path });
    },
    [navigate]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-lg">
        <DialogTitle className="sr-only">Pesquisar</DialogTitle>
        <Command>
          <CommandInput placeholder="Pesquisar páginas e ações..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup heading="Ações rápidas">
              {ACTIONS.map((a) => (
                <CommandItem
                  key={a.label}
                  onSelect={() => runCommand(a.path)}
                  className="cursor-pointer"
                  keywords={a.keywords.split(" ")}
                >
                  <a.icon className="mr-2 h-4 w-4 text-primary" />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Páginas">
              {pages.map((p) => (
                <CommandItem
                  key={p.path}
                  onSelect={() => runCommand(p.path)}
                  className="cursor-pointer"
                >
                  {p.icon ? (
                    <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

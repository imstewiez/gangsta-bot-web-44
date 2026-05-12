import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Bell, ShoppingCart, PackageCheck, Coins, AlertTriangle, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate } from "@/lib/domain";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    load();
  };

  const typeMeta = (t: string): { Icon: LucideIcon; tone: string; color: string } => {
    if (t.startsWith("order")) return { Icon: ShoppingCart, tone: "border-l-info", color: "text-info" };
    if (t.startsWith("delivery")) return { Icon: PackageCheck, tone: "border-l-warning", color: "text-warning" };
    if (t.startsWith("liquidation") || t.startsWith("payout")) return { Icon: Coins, tone: "border-l-success", color: "text-success" };
    if (t.includes("warn") || t.includes("alert")) return { Icon: AlertTriangle, tone: "border-l-destructive", color: "text-destructive" };
    return { Icon: Bell, tone: "border-l-primary", color: "text-primary" };
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
          <div className="inline-flex items-center gap-1.5 text-display text-xs font-bold uppercase tracking-wider">
            <Bell className="h-3.5 w-3.5 text-primary" />
            Recados do bairro
          </div>
          {unread > 0 && <span className="text-[10px] text-muted-foreground">{unread} por ler</span>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">Tudo calmo por aqui. Nada de novo no bairro.</p>
          )}
          {items.map((n) => {
            const meta = typeMeta(n.type);
            const handleClick = () => {
              setOpen(false);
              if (n.link) router.navigate({ to: n.link });
            };
            return (
              <button
                key={n.id}
                onClick={handleClick}
                className={
                  "block w-full border-b border-border border-l-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/40 " +
                  meta.tone + " " +
                  (n.read_at ? "opacity-60" : "bg-card")
                }
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-base leading-none">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{n.title}</div>
                    {n.body && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{fmtDate(n.created_at)}</div>
                  </div>
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

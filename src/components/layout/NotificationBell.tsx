import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Bell, ShoppingCart, PackageCheck, Coins, AlertTriangle, Trash2, CheckCheck,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";

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
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
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
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((n) => !n.read_at).length;
  const readCount = items.length - unread;

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  const markAllRead = async () => {
    if (!user || !unread) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    setBusy(true);
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível marcar como lidas.");
    } else {
      toast("Tudo posto à vista.");
      load();
    }
  };

  const clearRead = async () => {
    if (!user || !readCount) return;
    const ids = items.filter((n) => n.read_at).map((n) => n.id);
    setBusy(true);
    const { error } = await supabase.from("notifications").delete().in("id", ids);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível limpar.");
    } else {
      toast("Lidas apagadas.");
      load();
    }
  };

  const typeMeta = (t: string): { Icon: LucideIcon; tone: string; color: string } => {
    if (t.startsWith("order")) return { Icon: ShoppingCart, tone: "border-l-info", color: "text-info" };
    if (t.startsWith("delivery")) return { Icon: PackageCheck, tone: "border-l-warning", color: "text-warning" };
    if (t.startsWith("liquidation") || t.startsWith("payout")) return { Icon: Coins, tone: "border-l-success", color: "text-success" };
    if (t.includes("warn") || t.includes("alert")) return { Icon: AlertTriangle, tone: "border-l-destructive", color: "text-destructive" };
    return { Icon: Bell, tone: "border-l-primary", color: "text-primary" };
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="relative" title="Recados">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <div className="inline-flex items-center gap-1.5 text-display text-xs font-bold uppercase tracking-wider">
            <Bell className="h-3.5 w-3.5 text-primary" />
            Recados
          </div>
          <span className="text-[10px] text-muted-foreground">
            {unread > 0 ? `${unread} por ler` : items.length ? "tudo lido" : ""}
          </span>
        </div>

        {(unread > 0 || readCount > 0) && (
          <div className="flex items-center gap-1 border-b border-border bg-card/40 px-2 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              disabled={!unread || busy}
              onClick={markAllRead}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Marcar todas lidas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
              disabled={!readCount || busy}
              onClick={clearRead}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar lidas
            </Button>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">
              Tudo calmo. Sem recados novos.
            </p>
          )}
          {items.map((n) => {
            const meta = typeMeta(n.type);
            const handleClick = () => {
              if (!n.read_at) markOneRead(n.id);
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
                  <meta.Icon className={"mt-0.5 h-4 w-4 shrink-0 " + meta.color} />
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

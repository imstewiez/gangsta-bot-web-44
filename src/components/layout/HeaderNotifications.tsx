import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
  created_at: string;
  read_at: string | null;
};

async function fetchNotifications(userId?: string | null): Promise<NotificationRow[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,body,link,type,created_at,read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return data ?? [];
}

async function markRead(ids: string[]) {
  if (!ids.length) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
}

export function HeaderNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user?.id),
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const rows = query.data ?? [];
  const unread = rows.filter((n) => !n.read_at);

  async function onOpen(open: boolean) {
    if (!open || unread.length === 0) return;
    await markRead(unread.map((n) => n.id));
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }

  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Notificações"
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-primary/25 bg-background/45 text-primary backdrop-blur-xl transition-colors hover:bg-primary/12"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_80%,transparent)]" />
          )}
          <span className="sr-only">Notificações</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="app-dropdown w-[340px] p-2">
        <div className="px-2 py-2">
          <div className="text-display text-[11px] tracking-[0.22em] text-primary">Notificações</div>
          <div className="mt-1 text-xs text-muted-foreground">{unread.length} por ler</div>
        </div>
        <div className="mt-1 max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">A carregar...</div>
          ) : rows.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">Sem notificações.</div>
          ) : (
            rows.map((n) => {
              const content = (
                <div className={cn("app-row rounded-xl border px-3 py-2", n.read_at ? "border-white/[0.06] bg-white/[0.02]" : "border-primary/25 bg-primary/10")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{n.title}</div>
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                  <div className="mt-1 text-[10px] text-muted-foreground/70">{new Date(n.created_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              );
              return n.link ? <Link key={n.id} to={n.link}>{content}</Link> : <div key={n.id}>{content}</div>;
            })
          )}
        </div>
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => query.refetch()}>
          Atualizar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

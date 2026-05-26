import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Notificações | Ballas Gang" }],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  useRealtimeSync([{ table: "notifications", queryKeys: [["notifications"]] }]);
  const listFn = useAuthedServerFn(listMyNotifications);
  const readFn = useAuthedServerFn(markNotificationRead);
  const readAllFn = useAuthedServerFn(markAllNotificationsRead);
  const qc = useQueryClient();

  const notifs = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
  });

  const readM = useMutation({
    mutationFn: (id: number) => readFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllM = useMutation({
    mutationFn: () => readAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Todas marcadas como lidas");
    },
  });

  const unreadCount = (notifs.data ?? []).filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Notificações"
        description={unreadCount > 0 ? `${unreadCount} não lida${unreadCount !== 1 ? "s" : ""}` : "Tudo em dia"}
        icon={Bell}
      />

      {unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <ButtonLoading
            size="sm"
            variant="outline"
            loading={readAllM.isPending}
            onClick={() => readAllM.mutate()}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Marcar todas como lidas
          </ButtonLoading>
        </div>
      )}

      <Reveal direction="up">
        <div className="space-y-2">
          {(notifs.data ?? []).map((n) => (
            <Card
              key={n.id}
              className={cn(
                "interactive-card cursor-pointer transition-colors",
                !n.read && "border-primary/30 bg-primary/[0.02]"
              )}
              onClick={() => {
                if (!n.read) readM.mutate(n.id);
              }}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-muted" : "bg-primary")} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <span>{fmtDate(n.created_at)}</span>
                    {n.link && (
                      <Link
                        to={n.link}
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!notifs.isLoading && !(notifs.data ?? []).length && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Sem notificações.
            </div>
          )}
        </div>
      </Reveal>
    </>
  );
}

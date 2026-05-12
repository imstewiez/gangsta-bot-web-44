import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAvailability, getAvailabilityVotes } from "@/lib/ops.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/disponibilidade")({ component: Page });

function Page() {
  const fn = useServerFn(listAvailability);
  const votesFn = useServerFn(getAvailabilityVotes);
  const sessions = useQuery({ queryKey: ["availability"], queryFn: () => fn() });
  const [openId, setOpenId] = useState<number | null>(null);
  const votes = useQuery({
    queryKey: ["availabilityVotes", openId],
    queryFn: () => votesFn({ data: { session_id: openId! } }),
    enabled: openId != null,
  });
  return (
    <>
      <PageHeader eyebrow="Bairro" title="Disponibilidade" description="Sessões diárias e votos." icon={CalendarClock} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-display text-sm">Sessões</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {sessions.isLoading && (
              <div className="space-y-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            {(sessions.data ?? []).map((s) => (
              <button key={s.id} onClick={() => setOpenId(s.id)}
                className={"flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left text-sm " +
                  (openId === s.id ? "border-primary bg-accent/40" : "border-border hover:bg-accent/30")}>
                <div className="flex-1">
                  <div className="font-medium">{fmtDate(s.session_date).split(",")[0]}</div>
                  <div className="text-xs text-muted-foreground">{s.header_text ?? "—"}</div>
                </div>
                <span className="rounded-sm bg-muted px-2 py-1 text-xs text-display">{s.status}</span>
                <span className="text-xs text-muted-foreground">{s.vote_count} votos</span>
              </button>
            ))}
            {!sessions.isLoading && !sessions.data?.length && <p className="text-sm text-muted-foreground">Sem sessões.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-display text-sm">Votos {openId ? `(sessão #${openId})` : ""}</CardTitle></CardHeader>
          <CardContent>
            {!openId && <p className="text-sm text-muted-foreground">Escolhe uma sessão.</p>}
            {openId && votes.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            )}
            {openId && votes.data && (
              <div className="space-y-3">
                {votes.data.slots.map((s) => {
                  const slotVotes = votes.data.votes.filter((v) => v.slot_id === s.id);
                  return (
                    <div key={s.id}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium">{s.slot_label}</span>
                        <span className="text-xs text-muted-foreground">{slotVotes.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {slotVotes.map((v) => (
                          <span key={v.discord_user_id} className={
                            "rounded-sm px-2 py-0.5 text-xs font-mono " +
                            (v.vote_state === "yes" ? "bg-success/20 text-success"
                              : v.vote_state === "maybe" ? "bg-warning/20 text-warning"
                              : "bg-muted text-muted-foreground")
                          }>{v.discord_user_id.slice(-4)}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!votes.data.slots.length && <p className="text-sm text-muted-foreground">Sem slots.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

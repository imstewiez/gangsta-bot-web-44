import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { listAvailability, getAvailabilityVotes, castAvailabilityVote } from "@/lib/operations.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { useState } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Loader2, CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Reveal } from "@/components/layout/Reveal";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/disponibilidade")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Disponibilidade | Ballas Gang" }],
  }),
  component: Page,
});

function Page() {
  useRealtimeSync([
    { table: "availability_sessions", queryKeys: [["availability"]] },
    { table: "availability_votes", queryKeys: [["availability"], ["availabilityVotes"]] },
  ]);
  const fn = useAuthedServerFn(listAvailability);
  const votesFn = useAuthedServerFn(getAvailabilityVotes);
  const castFn = useAuthedServerFn(castAvailabilityVote);
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: ["availability"],
    queryFn: () => fn(),
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const votes = useQuery({
    queryKey: ["availabilityVotes", openId],
    queryFn: () => votesFn({ data: { session_id: openId! } }),
    enabled: openId != null,
  });

  const voteM = useMutation({
    mutationFn: (v: { session_id: number; slot_id: number; vote_state: "yes" | "maybe" | "no" }) =>
      castFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availabilityVotes", openId] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      toast.success("Voto registado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Estrutura"
        title="Disponibilidade"
        description="Marca a tua disponibilidade para as sessões"
      />
      <Reveal direction="up">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="interactive-card">
            <CardHeader>
              <CardTitle className="text-display text-sm">Sessões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sessions.isLoading && <PageSkeleton rows={6} />}
              {(sessions.data ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className={
                    "flex w-full cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-left text-sm " +
                    (openId === s.id
                      ? "border-primary bg-accent/40"
                      : "border-border interactive-row")
                  }
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {fmtDate(s.session_date).split(",")[0]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.header_text ?? "—"}
                    </div>
                  </div>
                  <span className="rounded-sm bg-muted px-2 py-1 text-xs text-display">
                    {s.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.vote_count} voto{s.vote_count !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
              {!sessions.isLoading && !(sessions.data ?? []).length && (
                <EmptyState title="Nenhuma sessão" description="Nenhuma sessão de disponibilidade" />
              )}
            </CardContent>
          </Card>

          <Card className="interactive-card">
            <CardHeader>
              <CardTitle className="text-display text-sm">Slots</CardTitle>
            </CardHeader>
            <CardContent>
              {openId == null && (
                <p className="text-sm text-muted-foreground">Seleciona uma sessão à esquerda.</p>
              )}
              {openId != null && votes.isLoading && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
              {openId != null && !votes.isLoading && (
                <div className="space-y-3">
                  {(votes.data?.slots ?? []).map((slot) => {
                    const slotVotes = (votes.data?.votes ?? []).filter((v) => v.slot_id === slot.id);
                    const yesCount = slotVotes.filter((v) => v.vote_state === "yes").length;
                    const maybeCount = slotVotes.filter((v) => v.vote_state === "maybe").length;
                    const noCount = slotVotes.filter((v) => v.vote_state === "no").length;
                    return (
                      <div key={slot.id} className="rounded-sm border border-border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">{slot.slot_label}</span>
                          <div className="flex gap-2 text-xs">
                            <span className="text-emerald-400">{yesCount} sim</span>
                            <span className="text-amber-400">{maybeCount} talvez</span>
                            <span className="text-muted-foreground">{noCount} não</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {slotVotes.map((v) => (
                            <span
                              key={v.user_tag + v.vote_state}
                              className={
                                "rounded-sm px-2 py-0.5 text-xs font-mono " +
                                (v.vote_state === "yes"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : v.vote_state === "maybe"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-muted text-muted-foreground")
                              }
                            >
                              {v.user_tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <ButtonLoading
                            size="sm"
                            variant="outline"
                            loading={voteM.isPending}
                            onClick={() =>
                              voteM.mutate({ session_id: openId, slot_id: slot.id, vote_state: "yes" })
                            }
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                            Sim
                          </ButtonLoading>
                          <ButtonLoading
                            size="sm"
                            variant="outline"
                            loading={voteM.isPending}
                            onClick={() =>
                              voteM.mutate({ session_id: openId, slot_id: slot.id, vote_state: "maybe" })
                            }
                          >
                            <HelpCircle className="mr-1 h-3.5 w-3.5 text-amber-400" />
                            Talvez
                          </ButtonLoading>
                          <ButtonLoading
                            size="sm"
                            variant="outline"
                            loading={voteM.isPending}
                            onClick={() =>
                              voteM.mutate({ session_id: openId, slot_id: slot.id, vote_state: "no" })
                            }
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                            Não
                          </ButtonLoading>
                        </div>
                      </div>
                    );
                  })}
                  {!votes.data?.slots.length && (
                    <EmptyState title="Nenhum slot" description="Nenhum slot nesta sessão" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Reveal>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { listAppUsers, setUserRole, checkSuperAdminAccess } from "@/lib/admin.functions";
import { getHeaderTickerMessages, updateHeaderTickerMessages } from "@/lib/header-ticker.functions";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Shield, ShieldOff, Crown, Loader2, Users, MessageSquareText, RotateCcw, Plus, Trash2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { ROLE_LABELS, EMPTY_STATE, LOADING, beautifyError } from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/admin/")({
  errorComponent: PageErrorBoundary,
  head: () => ({ meta: [{ title: "Definições | Ballas Gang" }] }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const superFn = useAuthedServerFn(checkSuperAdminAccess);
  const superCheck = useQuery({ queryKey: ["superAdminCheck"], queryFn: () => superFn() });
  const listFn = useAuthedServerFn(listAppUsers);
  const setFn = useAuthedServerFn(setUserRole);
  const tickerFn = useAuthedServerFn(getHeaderTickerMessages);
  const updateTickerFn = useAuthedServerFn(updateHeaderTickerMessages);
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["appUsers"], queryFn: () => listFn() });
  const ticker = useQuery({ queryKey: ["headerTickerMessages"], queryFn: () => tickerFn() });

  const isCallerSuper = superCheck.data?.is_superadmin ?? false;
  const [tickerDraft, setTickerDraft] = useState<string[]>([]);

  useEffect(() => {
    if (ticker.data?.messages) setTickerDraft(ticker.data.messages);
  }, [ticker.data?.messages]);

  const m = useMutation({
    mutationFn: (v: { user_id: string; role: "superadmin" | "admin" | "member"; grant: boolean }) => setFn({ data: v }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["appUsers"] });
      const prev = qc.getQueryData(["appUsers"]);
      qc.setQueryData(["appUsers"], (old: any) =>
        old?.map((u: any) =>
          u.user_id === vars.user_id
            ? { ...u, roles: vars.grant ? [...new Set([...u.roles, vars.role])] : u.roles.filter((r: string) => r !== vars.role) }
            : u,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["appUsers"], ctx.prev);
      toast.error(beautifyError(_e));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appUsers"] });
      toast.success("Atualizado");
    },
  });

  const tickerMutation = useMutation({
    mutationFn: () => {
      const messages = tickerDraft.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
      return updateTickerFn({ data: { messages } });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["headerTickerMessages"] });
      setTickerDraft(result.messages);
      toast.success("Mensagens do header atualizadas");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  function updateTickerLine(index: number, value: string) {
    setTickerDraft((current) => current.map((line, i) => (i === index ? value.slice(0, 160) : line)));
  }

  function addTickerLine() {
    setTickerDraft((current) => (current.length >= 12 ? current : [...current, "Nova mensagem do header"]));
  }

  function removeTickerLine(index: number) {
    setTickerDraft((current) => current.filter((_, i) => i !== index));
  }

  if (superCheck.isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <PageHeader eyebrow="Direção" title="Definições" description="Gerir permissões e sincronizar dados" />

      <Reveal direction="up" delay={80}>
        <Card className="interactive-card mb-5 border-primary/25 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-sm">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Mensagens do header
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
              Estas são as frases que passam no topo da app. Só Manda-Chuva/superadmins conseguem guardar alterações.
            </div>

            {ticker.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar mensagens...</div>
            ) : (
              <div className="space-y-2">
                {(tickerDraft.length ? tickerDraft : [""]).map((line, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/35 p-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</span>
                    <input
                      value={line}
                      onChange={(event) => updateTickerLine(index, event.target.value)}
                      disabled={!isCallerSuper}
                      maxLength={160}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-3 text-sm outline-none transition focus:border-primary disabled:opacity-70"
                      placeholder="Mensagem para aparecer no header..."
                    />
                    <Button type="button" variant="outline" size="sm" disabled={!isCallerSuper || tickerDraft.length <= 1} onClick={() => removeTickerLine(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{tickerDraft.filter((line) => line.trim()).length}/12 mensagens · 160 caracteres por mensagem</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!isCallerSuper || tickerDraft.length >= 12} onClick={addTickerLine}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!isCallerSuper} onClick={() => setTickerDraft(ticker.data?.defaults ?? [])}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Repor base
                </Button>
                <ButtonLoading size="sm" loading={tickerMutation.isPending} disabled={!isCallerSuper || tickerMutation.isPending || !tickerDraft.some((line) => line.trim())} onClick={() => tickerMutation.mutate()}>
                  Guardar mensagens
                </ButtonLoading>
              </div>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal direction="up" delay={150}>
        <Card className="interactive-card">
          <CardHeader><CardTitle className="text-display text-sm">Utilizadores da app</CardTitle></CardHeader>
          <CardContent>
            {users.isLoading && <div className="flex h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">{LOADING.generic}</p></div>}
            {users.error && <p className="text-sm text-destructive">{beautifyError(users.error)}</p>}
            <div className="space-y-2">
              {(users.data ?? []).map((u) => {
                const isAdmin = u.roles.includes("admin");
                const isSuper = u.roles.includes("superadmin");
                const canToggleSuper = isCallerSuper;
                const canToggleAdmin = isCallerSuper && !isSuper;
                return (
                  <div key={u.user_id} className="flex items-center gap-3 rounded-sm border border-border p-3 interactive-row">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{u.display_name ?? "(sem nome)"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{u.discord_id ?? u.user_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">desde {fmtDate(u.created_at)}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 text-xs">
                      {isSuper && <span className="rounded-sm border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-display text-amber-500"><Crown className="mr-1 inline h-3 w-3" />{ROLE_LABELS.superadmin}</span>}
                      {isAdmin && !isSuper && <span className="rounded-sm border border-primary/30 bg-primary/20 px-2 py-1 text-display text-primary"><Shield className="mr-1 inline h-3 w-3" />{ROLE_LABELS.admin}</span>}
                      {!isAdmin && !isSuper && <span className="rounded-sm bg-muted px-2 py-1 text-display">{ROLE_LABELS.member}</span>}
                    </div>
                    <div className="flex gap-2">
                      {canToggleSuper && <ButtonLoading size="sm" loading={m.isPending} variant={isSuper ? "outline" : "default"} disabled={m.isPending} onClick={() => m.mutate({ user_id: u.user_id, role: "superadmin", grant: !isSuper })}>{isSuper ? <><ShieldOff className="mr-1 h-3 w-3" />Remover Manda-Chuva</> : <><Crown className="mr-1 h-3 w-3" />Tornar Manda-Chuva</>}</ButtonLoading>}
                      {canToggleAdmin && <ButtonLoading size="sm" loading={m.isPending} variant={isAdmin ? "outline" : "default"} disabled={m.isPending} onClick={() => m.mutate({ user_id: u.user_id, role: "admin", grant: !isAdmin })}>{isAdmin ? <><ShieldOff className="mr-1 h-3 w-3" />Remover Direção</> : <><Shield className="mr-1 h-3 w-3" />Tornar Direção</>}</ButtonLoading>}
                    </div>
                  </div>
                );
              })}
              {!users.isLoading && !users.data?.length && <div className="col-span-full py-12 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">{EMPTY_STATE.users.title}</p><p className="mt-1 text-xs text-muted-foreground">{EMPTY_STATE.users.description}</p></div>}
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}

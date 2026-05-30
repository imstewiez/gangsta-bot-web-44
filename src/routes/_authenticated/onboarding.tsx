import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import {
  listTagRequests,
  approveTagRequest,
  denyTagRequest,
} from "@/lib/onboarding.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { beautifyError, STATUS_LABELS, LOADING, EMPTY_STATE } from "@/lib/messages";
import { checkManagerAccess } from "@/lib/access-check.functions";
import { Check, X, Loader2, Tag } from "lucide-react";
import { Reveal, Stagger } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: async () => {
    if (isServer()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: Page,
});

function Page() {
  const managerFn = useAuthedServerFn(checkManagerAccess);
  const managerCheck = useQuery({ queryKey: ["managerCheck"], queryFn: () => managerFn() });
  useRealtimeSync([{ table: "tag_requests", queryKeys: [["tagRequests"]] }]);
  const [tab, setTab] = useState("pending");
  const fn = useAuthedServerFn(listTagRequests);
  const approveFn = useAuthedServerFn(approveTagRequest);
  const denyFn = useAuthedServerFn(denyTagRequest);
  const qc = useQueryClient();
  const reqs = useQuery({
    queryKey: ["tagRequests", tab],
    queryFn: () => fn({ data: { status: tab } }),
  });
  const approve = useMutation({
    mutationFn: (id: number) => approveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tagRequests"] });
      toast.success("Aprovado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });
  const [denyId, setDenyId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const deny = useMutation({
    mutationFn: () => denyFn({ data: { id: denyId!, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tagRequests"] });
      toast.success("Recusado");
      setDenyId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });
  if (managerCheck.isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!managerCheck.data?.allowed) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Só a direção pode aceder a esta página.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Integração"
        description="Novos membros"
      />
      <Reveal direction="up">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {["pending", "approved", "denied", "all"].map((s) => (
              <TabsTrigger key={s} value={s} className="interactive-tab">
                {STATUS_LABELS[s] ?? s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Reveal>
      <Reveal direction="up" delay={100}>
        <div className="mt-4 space-y-2">
          {reqs.isLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{LOADING.generic}</p>
            </div>
          )}
        {(reqs.data ?? []).map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-sm border border-border bg-card p-3 interactive-row"
          >
            <div className="flex-1">
              <div className="font-medium">
                {r.full_name ?? r.username ?? "—"}{" "}
                <span className="text-muted-foreground text-xs">
                  {r.nickname ? `"${r.nickname}"` : ""}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {r.discord_id} · {fmtDate(r.created_at)}
              </div>
              {r.deny_reason && (
                <div className="text-xs text-destructive">
                  Razão: {r.deny_reason}
                </div>
              )}
            </div>
            <span className="rounded-sm bg-muted px-2 py-1 text-xs text-display">
              {STATUS_LABELS[r.status] ?? r.status}
            </span>
            {r.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => approve.mutate(r.id)}>
                  <Check className="mr-1 h-3 w-3" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDenyId(r.id)}
                >
                  <X className="mr-1 h-3 w-3" />
                  Recusar
                </Button>
              </div>
            )}
          </div>
        ))}
        {!reqs.isLoading && !reqs.data?.length && (
          <div className="col-span-full text-center py-12">
            <Tag className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">{EMPTY_STATE.onboarding.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{EMPTY_STATE.onboarding.description}</p>
          </div>
        )}
      </div>
      </Reveal>
      <Dialog open={denyId != null} onOpenChange={(v) => !v && setDenyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar pedido</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Razão"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDenyId(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!reason || deny.isPending}
              onClick={() => deny.mutate()}
            >
              {deny.isPending ? "" : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

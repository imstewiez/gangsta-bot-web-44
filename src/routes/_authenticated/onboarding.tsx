import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listTagRequests, approveTagRequest, denyTagRequest } from "@/lib/onboarding.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Check, X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const [tab, setTab] = useState("pending");
  const fn = useServerFn(listTagRequests);
  const approveFn = useServerFn(approveTagRequest);
  const denyFn = useServerFn(denyTagRequest);
  const qc = useQueryClient();
  const reqs = useQuery({ queryKey: ["tagRequests", tab], queryFn: () => fn({ data: { status: tab } }) });
  const approve = useMutation({
    mutationFn: (id: number) => approveFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tagRequests"] }); toast.success("Aprovado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [denyId, setDenyId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const deny = useMutation({
    mutationFn: () => denyFn({ data: { id: denyId!, reason } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tagRequests"] }); toast.success("Recusado"); setDenyId(null); setReason(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader eyebrow="Chefia" title="Onboarding" description="Pedidos de tag." icon={UserPlus} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>{["pending", "approved", "denied", "all"].map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="mt-4 space-y-2">
        {reqs.isLoading && <p className="text-muted-foreground">A carregar…</p>}
        {(reqs.data ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-sm border border-border bg-card p-3">
            <div className="flex-1">
              <div className="font-medium">{r.full_name ?? r.username ?? "—"} <span className="text-muted-foreground text-xs">{r.nickname ? `"${r.nickname}"` : ""}</span></div>
              <div className="text-xs text-muted-foreground font-mono">{r.discord_id} · {fmtDate(r.created_at)}</div>
              {r.deny_reason && <div className="text-xs text-destructive">Razão: {r.deny_reason}</div>}
            </div>
            <span className="rounded-sm bg-muted px-2 py-1 text-xs text-display">{r.status}</span>
            {r.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => approve.mutate(r.id)}><Check className="mr-1 h-3 w-3" />Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => setDenyId(r.id)}><X className="mr-1 h-3 w-3" />Recusar</Button>
              </div>
            )}
          </div>
        ))}
        {!reqs.isLoading && !reqs.data?.length && <p className="text-muted-foreground">Sem pedidos.</p>}
      </div>
      <Dialog open={denyId != null} onOpenChange={(v) => !v && setDenyId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar pedido</DialogTitle></DialogHeader>
          <Input placeholder="Razão" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDenyId(null)}>Cancelar</Button>
            <Button disabled={!reason || deny.isPending} onClick={() => deny.mutate()}>{deny.isPending ? "…" : "Recusar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

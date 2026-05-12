import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listAuditLogs } from "@/lib/ops.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const fn = useServerFn(listAuditLogs);
  const logs = useQuery({ queryKey: ["auditLogs"], queryFn: () => fn({ data: { limit: 200 } }) });
  return (
    <>
      <PageHeader eyebrow="Chefia" title="Auditoria" description="Eventos e mudanças do bairro." />
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Acção</th>
              <th className="px-3 py-2 text-left">Entidade</th><th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Contexto</th></tr>
          </thead>
          <tbody>
            {logs.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
            {(logs.data ?? []).map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-3 py-2 text-xs">{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ""}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.actor_name ?? l.actor_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-md">{l.context ?? ""}</td>
              </tr>
            ))}
            {!logs.isLoading && !logs.data?.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem registos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

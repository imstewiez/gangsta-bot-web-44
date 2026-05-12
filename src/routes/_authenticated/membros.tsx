import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMembers } from "@/lib/members.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { TIER_LABELS, ROLE_LABELS, tierColor, fmtDate, type Tier } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/membros")({ component: Page });

function Page() {
  const fn = useServerFn(listMembers);
  const { data, isLoading, error } = useQuery({ queryKey: ["members"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const list = Array.isArray(data) ? data : [];
  const filtered = list.filter((m) =>
    !q || (m.display_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (m.nick ?? "").toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader eyebrow="Bairro" title="Membros" description={`${list.length} no total.`}
        action={<Input placeholder="Procurar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />} />
      {error && (
        <div className="mb-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Erro a carregar membros: {error instanceof Error ? error.message : String(error)}
        </div>
      )}
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Alcunha</th>
            <th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-left">Tier</th>
            <th className="px-3 py-2 text-left">Entrou</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">A carregar…</td></tr>}
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-2"><Link to="/membros/$id" params={{ id: String(m.id) }} className="font-medium hover:text-primary">{m.display_name ?? "—"}</Link></td>
                <td className="px-3 py-2 text-muted-foreground">{m.nick ?? "—"}</td>
                <td className="px-3 py-2">{ROLE_LABELS[m.role_label ?? "bairrista"] ?? m.role_label}</td>
                <td className="px-3 py-2">{m.tier ? <span className={"rounded-sm border px-2 py-0.5 text-xs " + tierColor(m.tier as Tier)}>{TIER_LABELS[m.tier as Tier] ?? m.tier}</span> : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(m.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

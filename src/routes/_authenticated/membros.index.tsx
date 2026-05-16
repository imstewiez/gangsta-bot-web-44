import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useState } from "react";
import { listMembers } from "@/lib/members.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, POSITION_LABELS, fmtDate, TIER_ORDER } from "@/lib/domain";
import { TierBadge, AffiliationBadge } from "@/components/domain/RoleBadge";
import { TierIcon } from "@/components/domain/TierIcon";
import { Users } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";

export const Route = createFileRoute("/_authenticated/membros/")({ component: Page });

function Page() {
  const fn = useAuthedServerFn(listMembers);
  const { data, isLoading, error } = useQuery({ queryKey: ["members"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const list = Array.isArray(data) ? data : [];
  const filtered = list.filter((m) =>
    !q || (m.display_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (m.nick ?? "").toLowerCase().includes(q.toLowerCase())
  );
  // ordena por hierarquia (mais alto primeiro), depois alfabético
  const sorted = [...filtered].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(a.tier ?? "");
    const bi = TIER_ORDER.indexOf(b.tier ?? "");
    const aRank = ai === -1 ? -1 : ai;
    const bRank = bi === -1 ? -1 : bi;
    if (aRank !== bRank) return bRank - aRank;
    return (a.display_name ?? "").localeCompare(b.display_name ?? "", "pt");
  });
  return (
    <>
      <PageHeader eyebrow="Bairro" title="Membros" description={`${list.length} no total. Carrega num membro para ver o perfil completo.`}
        icon={Users}
        action={<Input placeholder="Procurar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />} />
      {error && (
        <div className="mb-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Erro a carregar membros: {error instanceof Error ? error.message : String(error)}
        </div>
      )}
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Alcunha</th>
              <th className="px-3 py-2 text-left">Posição</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">Afiliação</th>
              <th className="px-3 py-2 text-left">Entrou</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <TableRowsSkeleton rows={8} cols={6} widths={["w-40", "w-24", "w-28", "w-16", "w-24", "w-20"]} />
            )}
            {sorted.map((m) => (
              <tr key={m.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-2">
                  <Link to="/membros/$id" params={{ id: String(m.id) }} className="font-medium hover:text-primary inline-flex items-center gap-2">
                    <TierIcon tier={m.tier} size="sm" />
                    {m.display_name ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m.nick ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{POSITION_LABELS[m.tier ?? "bairrista"] ?? m.tier}</td>
                <td className="px-3 py-2"><TierBadge tier={m.tier} /></td>
                <td className="px-3 py-2"><AffiliationBadge tier={m.tier} /></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(m.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


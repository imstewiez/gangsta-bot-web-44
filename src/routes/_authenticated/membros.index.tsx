import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState } from "react";
import { listMembers } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { syncDiscordMembers } from "@/lib/member-sync.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, POSITION_LABELS, fmtDate, TIER_ORDER } from "@/lib/domain";
import { TierBadge, AffiliationBadge } from "@/components/domain/RoleBadge";
import { TierIcon } from "@/components/domain/TierIcon";
import { Users, RotateCcw, Loader2, RefreshCw } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import { PLACEHOLDER, LOADING, beautifyError } from "@/lib/messages";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/membros/")({
  head: () => ({
    meta: [{ title: "Membros | Ballas Gang" }],
  }),
  component: Page,
});

function Page() {
  useRealtimeSync(["members"]);
  const fn = useAuthedServerFn(listMembers);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["members"],
    queryFn: () => fn(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
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
      <PageHeader eyebrow="Bairro" title="Membros" description={`${list.length} membro${list.length !== 1 ? "s" : ""}`}
        icon={Users}
        action={<Input placeholder={PLACEHOLDER.searchMembers} value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />} />
      {error && (
        <Reveal direction="up">
          <div className="mb-4 flex items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm animate-rise">
            <span className="text-destructive">{beautifyError(error)}</span>
            <button
              onClick={() => refetch()}
              className="ml-auto inline-flex cursor-pointer items-center gap-1 text-display text-[10px] tracking-wider text-destructive underline underline-offset-2 hover:text-destructive/80"
            >
              <RotateCcw className="h-3 w-3" />
              Tentar de novo
            </button>
          </div>
        </Reveal>
      )}
      <Reveal direction="up" delay={100}>
        <div className="overflow-hidden rounded-sm border border-border">
          <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr className="interactive-row">
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
              <tr>
                <td colSpan={6} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{LOADING.members}</p>
                  </div>
                </td>
              </tr>
            )}
            {sorted.map((m) => (
              <tr key={m.id} className="border-t border-border interactive-row transition-colors duration-150 cursor-pointer">
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
      </Reveal>
    </>
  );
}


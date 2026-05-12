import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMember } from "@/lib/members.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtDate, TIER_LABELS, ROLE_LABELS, tierColor, type Tier } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/membros/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const fn = useServerFn(getMember);
  const { data, isLoading } = useQuery({ queryKey: ["member", id], queryFn: () => fn({ data: { id: Number(id) } }) });
  if (isLoading) return <p className="text-muted-foreground">A carregar…</p>;
  if (!data?.member) return <p>Membro não encontrado. <Link to="/membros" className="text-primary">Voltar</Link></p>;
  const m = data.member;
  return (
    <>
      <PageHeader eyebrow={ROLE_LABELS[m.role_label ?? "bairrista"]} title={m.display_name ?? "—"} description={m.nick ? `"${m.nick}"` : undefined}
        action={m.tier ? <span className={"rounded-sm border px-3 py-1 text-display text-xs " + tierColor(m.tier as Tier)}>{TIER_LABELS[m.tier as Tier] ?? m.tier}</span> : null} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-display text-sm">Entrou</CardTitle></CardHeader><CardContent>{fmtDate(m.joined_at)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-display text-sm">Discord ID</CardTitle></CardHeader><CardContent className="font-mono text-xs">{m.discord_id ?? "—"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-display text-sm">Kills</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-primary">{fmtNum(data.kills)}</CardContent></Card>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-display text-sm">Contribuições</CardTitle></CardHeader>
          <CardContent>
            {data.contributions.length === 0 ? <p className="text-sm text-muted-foreground">Sem registos.</p> :
              <ul className="space-y-1.5">{data.contributions.map((c) => (
                <li key={c.type} className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
                  <span className="text-muted-foreground">{c.type}</span><span className="font-mono">{fmtNum(c.total)}</span>
                </li>))}
              </ul>}
          </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-display text-sm">Movimentos recentes</CardTitle></CardHeader>
          <CardContent>
            {data.recentMovements.length === 0 ? <p className="text-sm text-muted-foreground">Sem movimentos.</p> :
              <ul className="space-y-1">{data.recentMovements.map((mv) => (
                <li key={mv.id} className="flex items-baseline gap-2 border-b border-border/50 py-1.5 text-xs last:border-0">
                  <span className="text-muted-foreground">{fmtDate(mv.created_at).split(",")[0]}</span>
                  <span>{mv.type}</span><span className="text-muted-foreground">{mv.item_name ?? "—"}</span>
                  <span className="ml-auto font-mono">{fmtNum(mv.qty)}</span>
                </li>))}
              </ul>}
          </CardContent></Card>
      </div>
    </>
  );
}

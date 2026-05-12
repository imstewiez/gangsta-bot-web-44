import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listKills } from "@/lib/operations.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate } from "@/lib/domain";
import { Skull } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cemiterio")({ component: Page });

function Page() {
  const fn = useServerFn(listKills);
  const { data, isLoading } = useQuery({ queryKey: ["kills"], queryFn: () => fn() });
  return (
    <>
      <PageHeader eyebrow="RIP" title="Cemitério" description="Quem caiu por mãos do bairro." />
      <div className="space-y-2">
        {isLoading && <p className="text-muted-foreground">A carregar…</p>}
        {(data ?? []).map((k) => (
          <div key={k.id} className="flex items-center gap-4 rounded-sm border border-border bg-card p-3">
            <Skull className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="text-sm"><span className="font-medium">{k.member_name ?? "—"}</span> matou <span className="text-primary font-medium">{k.victim ?? "—"}</span></div>
              {k.notes && <div className="text-xs text-muted-foreground">{k.notes}</div>}
            </div>
            <div className="text-xs text-muted-foreground">{k.weapon ?? ""}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(k.created_at)}</div>
          </div>
        ))}
        {!isLoading && !data?.length && <p className="text-muted-foreground">Cemitério vazio.</p>}
      </div>
    </>
  );
}

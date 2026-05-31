import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ShieldCheck, X } from "lucide-react";
import { useAuthedServerFn, getViewAsMemberId, setViewAsMemberId } from "@/lib/authed-server-fn";
import { getCurrentMember } from "@/lib/pricing.functions";
import { listViewAsTargets } from "@/lib/view-as.functions";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";

function labelFor(member: { display_name: string | null; nick: string | null; tier: string | null; role_label: string | null }) {
  const name = member.display_name ?? member.nick ?? `Membro #${"id" in member ? member.id : ""}`;
  const role = member.role_label || member.tier || "sem cargo";
  return `${name} · ${role}`;
}

export function ViewAsSwitcher() {
  const meFn = useAuthedServerFn(getCurrentMember);
  const targetsFn = useAuthedServerFn(listViewAsTargets);
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const enabled = Boolean(me.data?.is_superadmin || me.data?.is_viewing_as);
  const targets = useQuery({ queryKey: ["view-as-targets"], queryFn: () => targetsFn(), enabled });

  if (!enabled) return null;

  const current = getViewAsMemberId() ?? "";
  const options = (targets.data ?? []).map((member) => ({
    value: String(member.id),
    label: labelFor(member),
    group: member.is_superadmin ? "Direção Total" : member.is_manager ? "Chefia" : "Membros",
  }));

  function refresh() {
    qc.clear();
    window.location.reload();
  }

  function change(value: string) {
    setViewAsMemberId(value || null);
    toast.success("Modo de visualização alterado");
    refresh();
  }

  function stop() {
    setViewAsMemberId(null);
    toast.success("Voltaste à tua sessão real");
    refresh();
  }

  return (
    <div className="flex min-w-[280px] items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5">
      <Eye className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <ShieldCheck className="h-3 w-3" /> Ver como
        </div>
        <SearchableSelect
          value={current}
          onChange={change}
          options={options}
          placeholder={me.data?.is_viewing_as ? me.data.display_name ?? "Membro" : "Escolher membro"}
          searchPlaceholder="Procurar membro..."
          emptyText="Sem membros disponíveis."
          className="h-8 border-primary/30 bg-background/60 text-xs"
        />
      </div>
      {current && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={stop} title="Sair do modo ver como"><X className="h-4 w-4" /></Button>}
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => (
    <>
      <PageHeader eyebrow="Chefia" title="Admin" description="Aprovações, catálogo, configuração — em breve (Phase 2/3)." />
      <p className="text-muted-foreground">Esta área será preenchida nos próximos builds: aprovações de tags, edição de catálogo, modo manutenção, audit log.</p>
    </>
  ),
});

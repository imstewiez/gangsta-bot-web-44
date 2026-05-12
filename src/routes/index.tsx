import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background bg-grain">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary font-display text-primary-foreground">R</div>
          <span className="text-display text-sm tracking-widest">Firma RedWood</span>
        </header>

        <main className="my-auto grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="text-display text-xs text-primary mb-4">Bairro · Gangsta di Zona</div>
            <h1 className="text-display text-5xl font-bold leading-[1.05] md:text-6xl">
              O <span className="text-primary">bairro</span><br/>tem painel.
            </h1>
            <p className="mt-6 max-w-md text-muted-foreground">
              Onboarding, hierarquia, ledger, saídas, cemitério e tops.
              Tudo o que o bot fazia, agora também aqui — em painel limpo, sem
              perder o Discord como casa.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                to="/login"
                className="rounded-sm bg-primary px-6 py-3 text-display text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Entrar
              </Link>
            </div>
          </div>
          <div className="rounded-sm border border-border bg-card p-6 shadow-2xl">
            <div className="text-display text-xs text-muted-foreground mb-3">Hierarquia</div>
            <ul className="space-y-2 text-sm">
              {[
                ["1", "Manda-Chuva", "Comando total"],
                ["2", "Kingpin", "Comando"],
                ["3", "OG", "Supervisão"],
                ["4", "Real Gangster", "Supervisão"],
                ["5", "Patrão di Zona", "Chefe do bairro"],
                ["6", "Gangster Fodido", "Bairrista · topo"],
                ["7", "O Gunão", "Bairrista · mid"],
                ["8", "Young Blood", "Bairrista · entrada"],
              ].map(([n, name, desc]) => (
                <li key={n} className="flex items-center gap-3 border-b border-border/50 py-1.5 last:border-0">
                  <span className="text-display w-6 text-primary">{n}</span>
                  <span className="font-medium">{name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </main>

        <footer className="mt-10 text-xs text-muted-foreground">
          © Firma RedWood · powered by lealdade
        </footer>
      </div>
    </div>
  );
}

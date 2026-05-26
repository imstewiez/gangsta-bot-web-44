import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Reveal } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/operacoes")({
  component: OperacoesLayout,
});

function OperacoesLayout() {
  return <Outlet />;
}

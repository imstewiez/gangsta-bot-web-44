import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operacoes")({
  component: OperacoesLayout,
});

function OperacoesLayout() {
  return <Outlet />;
}

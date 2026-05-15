import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/membros")({
  component: Page,
});

function Page() {
  return <Outlet />;
}

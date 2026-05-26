import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Reveal } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/membros")({
  component: Page,
});

function Page() {
  return <Outlet />;
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { Reveal } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/liquidacao")({
  beforeLoad: () => {
    throw redirect({ to: "/operacoes" });
  },
  component: () => null,
});

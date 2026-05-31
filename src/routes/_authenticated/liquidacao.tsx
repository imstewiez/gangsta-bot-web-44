import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/liquidacao")({
  beforeLoad: () => {
    throw redirect({ to: "/operacoes" });
  },
  component: () => null,
});

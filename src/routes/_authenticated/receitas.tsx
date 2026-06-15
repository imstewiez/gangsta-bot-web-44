import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/receitas")({
  beforeLoad: async () => {
    throw redirect({ to: "/precario" });
  },
});

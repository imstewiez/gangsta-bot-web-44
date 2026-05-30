import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/receitas")({
  beforeLoad: async () => {
    throw redirect({ to: "/receitas" });
  },
});

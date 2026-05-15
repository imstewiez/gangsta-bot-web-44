import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/health")({
  GET: async () => {
    return json({
      ok: true,
      database_url: process.env.DATABASE_URL ? "[set]" : "[missing]",
      timestamp: new Date().toISOString(),
    });
  },
});

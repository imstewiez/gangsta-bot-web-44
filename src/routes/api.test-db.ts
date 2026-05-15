import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { pgQuery } from "../lib/pg.server";

export const APIRoute = createAPIFileRoute("/api/test-db")({
  GET: async () => {
    try {
      const rows = await pgQuery("SELECT COUNT(*)::int as cnt FROM members");
      return json({
        database_url: process.env.DATABASE_URL ? "[set]" : "[missing]",
        db_test: "OK",
        members_count: rows[0]?.cnt ?? 0,
      });
    } catch (e: any) {
      return json({
        database_url: process.env.DATABASE_URL ? "[set]" : "[missing]",
        db_test: "ERROR",
        error: e.message || String(e),
        stack: e.stack || "",
      }, { status: 500 });
    }
  },
});

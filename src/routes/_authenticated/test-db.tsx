import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { pgQuery } from "../../lib/pg.server";

const testDb = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await pgQuery("SELECT COUNT(*)::int as cnt FROM members");
    return {
      database_url: process.env.DATABASE_URL ? "[set]" : "[missing]",
      hyperdrive: process.env.HYPERDRIVE ? "[set]" : "[missing]",
      db_test: "OK",
      members_count: rows[0]?.cnt ?? 0,
    };
  } catch (e: any) {
    return {
      database_url: process.env.DATABASE_URL ? "[set]" : "[missing]",
      hyperdrive: process.env.HYPERDRIVE ? "[set]" : "[missing]",
      db_test: "ERROR",
      error: e.message || String(e),
      stack: e.stack || "",
    };
  }
});

export const Route = createFileRoute("/_authenticated/test-db")({
  component: Page,
});

function Page() {
  const [result, setResult] = React.useState<any>(null);
  React.useEffect(() => {
    testDb().then(setResult);
  }, []);
  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4">Teste DB</h1>
      <pre className="bg-black/50 p-4 rounded text-sm whitespace-pre-wrap">
        {result ? JSON.stringify(result, null, 2) : "A carregar..."}
      </pre>
    </div>
  );
}

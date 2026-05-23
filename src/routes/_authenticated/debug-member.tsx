import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { debugMemberData } from "@/lib/members.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/debug-member")({
  component: Page,
});

function Page() {
  const [id, setId] = useState("");
  const fn = useAuthedServerFn(debugMemberData);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["debug-member", id],
    queryFn: () => fn({ data: { id: Number(id) } }),
    enabled: false,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Debug Member Data</h1>
      <div className="flex gap-2">
        <Input
          placeholder="Member ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="w-40"
        />
        <Button onClick={() => refetch()} disabled={!id || isLoading}>
          {isLoading ? "Loading..." : "Check"}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-400">{String(error)}</pre>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Member: {data.member_name} (ID: {data.member_id})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>Orders count: {data.orders_count}</p>
              <p>Deliveries count: {data.deliveries_count}</p>
              <p>Sales count: {data.sales_count}</p>
              <p>Total movements count: {data.movements_count}</p>
            </CardContent>
          </Card>

          {data.orders_rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs">{JSON.stringify(data.orders_rows, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          {data.movements_rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>All Movements</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs">{JSON.stringify(data.movements_rows, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

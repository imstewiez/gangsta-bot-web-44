import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRecentLogs } from "../lib/logger";

const fetchLogs = createServerFn({ method: "GET" }).handler(async () => {
  return getRecentLogs(undefined, 50);
});

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchLogs()
      .then((data) => setLogs(data ?? []))
      .catch((err) => {
        console.error("Failed to fetch logs:", err);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-white">A carregar logs...</div>;

  return (
    <div className="p-10 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-4">📋 Logs da Aplicação</h1>
      {logs.length === 0 ? (
        <p>Sem logs.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-2">Tempo</th>
              <th className="text-left p-2">Nível</th>
              <th className="text-left p-2">Fonte</th>
              <th className="text-left p-2">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-800">
                <td className="p-2 text-gray-400">
                  {new Date(log.created_at).toLocaleString("pt-PT")}
                </td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      log.level === "error"
                        ? "bg-red-900 text-red-200"
                        : log.level === "warn"
                        ? "bg-yellow-900 text-yellow-200"
                        : "bg-blue-900 text-blue-200"
                    }`}
                  >
                    {log.level}
                  </span>
                </td>
                <td className="p-2 text-gray-300">{log.source}</td>
                <td className="p-2">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

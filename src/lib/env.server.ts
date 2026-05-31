// Server-only environment helpers for Cloudflare Workers + local Node tooling.
// Cloudflare injects env into the Worker handler; src/server.ts stores it on
// globalThis.__cloudflareEnv so server functions can read the same values.

export type WorkerEnvRecord = Record<string, unknown>;

export function setCloudflareEnv(env: unknown): void {
  if (env && typeof env === "object") {
    (globalThis as any).__cloudflareEnv = env as WorkerEnvRecord;
  }
}

export function getCloudflareEnv(): WorkerEnvRecord | undefined {
  const env = (globalThis as any).__cloudflareEnv;
  return env && typeof env === "object" ? (env as WorkerEnvRecord) : undefined;
}

function normalizeEnvValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getEnv(name: string, fallback?: string): string | undefined {
  const cfValue = normalizeEnvValue(getCloudflareEnv()?.[name]);
  if (cfValue) return cfValue;

  const processValue =
    typeof process !== "undefined" ? normalizeEnvValue(process.env?.[name]) : undefined;
  if (processValue) return processValue;

  return fallback;
}

export function requireEnv(name: string, fallback?: string): string {
  const value = getEnv(name, fallback);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function maskEnv(name: string): string | undefined {
  const value = getEnv(name);
  if (!value) return undefined;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

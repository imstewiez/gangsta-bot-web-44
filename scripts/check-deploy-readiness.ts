#!/usr/bin/env tsx
// Verifica se todas as configurações necessárias estão prontas para deploy.
// Uso: npx tsx scripts/check-deploy-readiness.ts

import { readFileSync } from "fs";
import { resolve } from "path";

const REQUIRED_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

const OPTIONAL_SECRETS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

function checkEnv(name: string): string | undefined {
  return process.env[name];
}

function checkMigration(): boolean {
  try {
    const path = resolve(process.cwd(), "supabase/migrations/20260529000000_audit_fix_critical_issues.sql");
    const content = readFileSync(path, "utf-8");
    return content.includes("sp_transition_order") && content.includes("sp_liquidate_saida");
  } catch {
    return false;
  }
}

function main() {
  console.log("🔍 Verificação de deploy readiness\n");

  let ok = true;

  // Check migration file
  console.log("📁 Migration SQL:");
  if (checkMigration()) {
    console.log("   ✅ Ficheiro de migration encontrado e válido");
  } else {
    console.log("   ❌ Ficheiro de migration não encontrado ou inválido");
    ok = false;
  }
  console.log("   ⚠️  Lembra-te: tens de executar manualmente no Supabase SQL Editor!\n");

  // Check required secrets
  console.log("🔐 Secrets obrigatórias:");
  for (const secret of REQUIRED_SECRETS) {
    const value = checkEnv(secret);
    if (value) {
      console.log(`   ✅ ${secret} — configurada (${value.slice(0, 8)}...)`);
    } else {
      console.log(`   ❌ ${secret} — NÃO configurada`);
      ok = false;
    }
  }
  console.log();

  // Check optional secrets
  console.log("🔧 Secrets opcionais (rate limiting distribuído):");
  const redisUrl = checkEnv("UPSTASH_REDIS_REST_URL");
  const redisToken = checkEnv("UPSTASH_REDIS_REST_TOKEN");
  if (redisUrl && redisToken) {
    console.log("   ✅ Upstash Redis configurado — rate limiting distribuído ativo");
  } else if (!redisUrl && !redisToken) {
    console.log("   ⚠️  Upstash Redis não configurado — rate limiting vai usar memória (ok para dev)");
  } else {
    console.log("   ❌ Configuração incompleta do Redis — ambos URL e TOKEN são necessários");
    ok = false;
  }
  console.log();

  // Check wrangler
  console.log("☁️  Cloudflare Worker:");
  try {
    const wrangler = readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf-8");
    if (wrangler.includes("gangsta-bot-web")) {
      console.log("   ✅ wrangler.jsonc encontrado");
    } else {
      console.log("   ❌ wrangler.jsonc parece inválido");
      ok = false;
    }
  } catch {
    console.log("   ❌ wrangler.jsonc não encontrado");
    ok = false;
  }
  console.log();

  // Summary
  if (ok) {
    console.log("✅ Tudo pronto para deploy!\n");
    console.log("   Próximo passo: npm run build && npx wrangler deploy\n");
  } else {
    console.log("❌ Ainda faltam configurações. Corrige os itens acima antes de fazer deploy.\n");
    console.log("   Guia completo: DEPLOY.md\n");
    process.exit(1);
  }
}

main();

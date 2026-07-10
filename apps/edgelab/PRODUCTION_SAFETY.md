# EdgeLab production safety boundary

This project must never modify, deploy over, or interfere with the Ballas production environment.

## Absolute rule

Do not touch or deploy anything that serves:

```txt
ballasgang.eu
www.ballasgang.eu
```

## Protected Ballas production files

For EdgeLab work, do not edit these root production files:

```txt
/wrangler.jsonc
/src/server.ts
/src/routes/**
/src/components/**
/src/lib/**
/src/integrations/**
```

The root app belongs to Ballas production.

## EdgeLab work area

All EdgeLab preview work must stay inside:

```txt
/apps/edgelab/**
/edgelab-starter/**
```

## Deployment boundary

EdgeLab must deploy only from:

```txt
apps/edgelab/wrangler.preview.jsonc
```

Never deploy EdgeLab using the root Wrangler config.

## Preview domain rule

If a public preview is needed, use a separate worker and a separate domain/subdomain, never the Ballas production routes.

Acceptable examples:

```txt
edgelab-preview.<workers-dev-domain>
edgelab.your-new-domain.com
```

Avoid using `ballasgang.eu` for this project unless explicitly approved again, and never bind it to the root production route.

## Database boundary

Use a separate EdgeLab Supabase project/database. Never point EdgeLab to the Ballas production database.

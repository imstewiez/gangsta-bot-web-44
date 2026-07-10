# EdgeLab safe preview deployment

This guide is for deploying EdgeLab without changing the Ballas production environment.

## Hard rule

Do not deploy from the repository root for EdgeLab.

Do not edit or use:

```txt
/wrangler.jsonc
/src/server.ts
```

Those belong to the Ballas production app.

## Preview app location

```txt
apps/edgelab
```

## Build locally

```bash
cd apps/edgelab
npm install
npm run build
```

## Preview with Cloudflare Workers dev

```bash
cd apps/edgelab
npm run preview
```

## Deploy preview Worker

```bash
cd apps/edgelab
npm run deploy:preview
```

This uses:

```txt
apps/edgelab/wrangler.preview.jsonc
```

not the root Wrangler config.

## Subdomain

Recommended preview subdomain:

```txt
edgelab.ballasgang.eu
```

Add the custom domain/route only to the EdgeLab Worker in Cloudflare after the preview Worker is confirmed working on workers.dev.

## Current preview limitations

The standalone preview app is local/state-only for the first URL check. It can:

- show the EdgeLab UI
- import a simple CSV into browser state
- configure MA Cross parameters
- run a basic MA Cross backtest
- show report metrics/orders

Database-backed save/load exists in the starter folder, but should only be activated after a separate EdgeLab Supabase project is ready.

## Supabase isolation

Use a separate Supabase project for EdgeLab. Do not point this preview to the Ballas production database.

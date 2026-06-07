# EdgeLab Preview App

This is an isolated preview app target for EdgeLab.

It must not modify or replace the production Ballas app served from the repository root.

## Safety boundary

Do not change these Ballas production files for EdgeLab preview work:

```txt
/wrangler.jsonc
/src/server.ts
/src/routes/**
/src/lib/**
```

The preview target lives under:

```txt
/apps/edgelab
```

## Intended preview domain

```txt
edgelab.ballasgang.eu
```

## Required before deploy

1. Create a separate Supabase project for EdgeLab.
2. Apply `edgelab-starter/supabase/migrations/001_edgelab_v01_schema.sql` to the EdgeLab database.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for this app only.
4. Deploy with the app-local `wrangler.jsonc`, not the root Ballas one.

## Local direction

The current source of truth for the app files is still `edgelab-starter/` while the preview app scaffold is created. The next step is to copy/promote the starter source into `apps/edgelab/src`.

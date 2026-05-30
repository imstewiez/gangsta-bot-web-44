# Agent Context — Ballas Gang Web App

> Last updated: 2026-05-30

## Project Overview

- **Stack**: TanStack Start + React + Cloudflare Workers
- **DB**: Supabase PostgreSQL
- **Config**: `config.json` = single source of truth for items, recipes, categories, tiers, XP
- **Deploy**: `ballasgang.eu` via Cloudflare Workers

---

## Item Side Model (venda / compra / ambos)

Each item has a `side` field that controls where it appears and what members can do with it:

| Side | Meaning | Appears in | Can order? | Can deliver? |
|------|---------|------------|------------|--------------|
| `venda` | Firm sells to members | Price list (sell tab), Stock | ✅ Yes | ✅ Yes (as sale) |
| `compra` | Firm buys from members | Price list (buy tab) | ❌ No | ✅ Yes (as delivery) |
| `ambos` | Firm does both | Both price list tabs, Stock | ✅ Yes | ✅ Yes |

**Key behaviour:**
- The `side` is read from the **DB** (not `config.json`) at runtime for catalog/stock/ledger filtering
- Changing `side` in Admin → Gestão de Items reflects immediately across the app
- DB constraint: `items_side_check` allows `'compra' | 'venda' | 'ambos'`

---

## Categories

Items are grouped by category. The display categories (in `armory.catalog.ts`) are:

- `armas_orange` — Orange weapons
- `armas_red` — Red weapons
- `carregadores` — Magazines
- `corpos` — Weapon bodies
- `prints` — Blueprints
- `coletes` — Vests
- `acessorios` — Accessories
- `reciclagem` — Recycling / scrap
- `outros` — Others

Plus raw material categories: `materiais`, `madeiras`, `metais`, `texteis`, `componentes`, `droga`, `equipamento`, `dinheiro`.

**Important:** Prints, Corpos, and Reciclagem items were moved from `outros`/`sucata_industria` to their proper categories in both `config.json` and DB.

---

## Pricing Model

| Column | Meaning |
|--------|---------|
| `purchase_price` | Price without materials ("Sem material") — firm cost |
| `min_sale_price` | Price with materials ("Com material") — sale price |
| `estimated_value` | Production cost / estimated value |
| `xp_points` | Points awarded per unit delivered |

**Price sync:** `getCatalog()` reads prices from DB (not `config.json`). Admin edits update DB directly.

---

## XP / Points System

- **Points are ONLY earned on deliveries** (`entrega_bairrista`, `entrega_oficial`)
- **Orders (encomendas) do NOT affect XP** — `venda_bairrista` is excluded from XP calculation
- Points shown in the "buy" price list tab indicate what members earn when delivering that material
- Zero-point categories: `quimicos_droga`, `dinheiro`

---

## Recipes in Admin

The Admin → Gestão de Items page shows a collapsible "Receita" column:
- Items with a recipe in `config.json` show ▼/▲ toggle
- Expanded row shows all ingredients, quantities, and estimated production cost

---

## Key Files

| File | Purpose |
|------|---------|
| `config.json` | Source of truth: items, recipes, categories, tiers, XP |
| `src/lib/config.loader.ts` | Loads and queries `config.json` |
| `src/lib/pricing.functions.ts` | `getCatalog()`, `getBuyCatalog()` — read DB prices |
| `src/lib/xp.functions.ts` | XP calculation (deliveries only) |
| `src/lib/armory.catalog.ts` | Display categories, icons, filters |
| `src/routes/_authenticated/admin.itens.tsx` | Item management UI |

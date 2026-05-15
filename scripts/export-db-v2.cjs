const postgres = require("postgres");
const fs = require("fs");
const path = require("path");

const sql = postgres(
  "postgresql://postgres:MvjrditCZFrsrwmHyUyAGVWGuevwYtKg@switchback.proxy.rlwy.net:58179/railway",
  { ssl: "require", max: 1, types: {
    // Force postgres driver to return everything as raw strings
    // except we can't easily do that. Instead we'll handle in code.
  }},
);

function formatValue(v, colType) {
  if (v === null || v === undefined) return "\\N";

  // Handle Date objects (postgres driver returns Dates for timestamp/date cols)
  if (v instanceof Date) {
    // ISO 8601 format that PostgreSQL COPY accepts
    return v.toISOString();
  }

  // Handle arrays (postgres driver returns arrays)
  if (Array.isArray(v)) {
    // PostgreSQL array literal format
    const arrStr = JSON.stringify(v)
      .replace(/\[/g, "{")
      .replace(/\]/g, "}")
      .replace(/"/g, '\\"');
    return arrStr;
  }

  // Handle objects (JSON/JSONB)
  if (typeof v === "object") {
    // This includes plain objects AND special postgres types that come as objects
    return JSON.stringify(v);
  }

  // Handle booleans
  if (typeof v === "boolean") {
    return v ? "t" : "f";
  }

  // Default: string with COPY escaping
  let s = String(v);
  s = s.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return s;
}

async function exportDb() {
  const outDir = path.join(__dirname, "../db-export");
  fs.mkdirSync(outDir, { recursive: true });

  let fullSql = "-- Exported from Railway PostgreSQL (v2)\n\n";

  // === ENUMS ===
  console.log("Exporting enums...");
  const enums = await sql`
    SELECT t.typname AS enum_name,
           array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `;

  for (const en of enums) {
    const labels = en.labels.map((l) => `'${l.replace(/'/g, "''")}'`).join(", ");
    fullSql += `DROP TYPE IF EXISTS "${en.enum_name}" CASCADE;\n`;
    fullSql += `CREATE TYPE "${en.enum_name}" AS ENUM (${labels});\n\n`;
  }

  // === SEQUENCES ===
  console.log("Exporting sequences...");
  const sequences = await sql`
    SELECT sequence_name, start_value, minimum_value, maximum_value, increment, cycle_option
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `;

  for (const s of sequences) {
    fullSql += `DROP SEQUENCE IF EXISTS "${s.sequence_name}";\n`;
    fullSql += `CREATE SEQUENCE "${s.sequence_name}"`;
    fullSql += ` START WITH ${s.start_value}`;
    fullSql += ` INCREMENT BY ${s.increment}`;
    fullSql += ` MINVALUE ${s.minimum_value}`;
    fullSql += ` MAXVALUE ${s.maximum_value}`;
    if (s.cycle_option === "YES") fullSql += ` CYCLE`;
    fullSql += `;\n\n`;
  }

  // === TABLES with correct types ===
  console.log("Exporting tables...");
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  for (const { table_name } of tables) {
    console.log(`  ${table_name}`);

    // Get columns with real PostgreSQL types using format_type
    const cols = await sql`
      SELECT
        a.attname AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
        a.attnotnull AS not_null,
        pg_get_expr(d.adbin, d.adrelid) AS column_default,
        col_description(a.attrelid, a.attnum) AS col_comment
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE a.attrelid = (SELECT oid FROM pg_class WHERE relname = ${table_name} AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    `;

    const colDefs = cols.map((c) => {
      let def = `  "${c.column_name}" ${c.data_type}`;
      if (c.column_default) def += ` DEFAULT ${c.column_default}`;
      if (c.not_null) def += " NOT NULL";
      return def;
    }).join(",\n");

    fullSql += `DROP TABLE IF EXISTS "${table_name}" CASCADE;\n`;
    fullSql += `CREATE TABLE "${table_name}" (\n${colDefs}\n);\n\n`;
  }

  // === CONSTRAINTS (PK, FK, UNIQUE, CHECK) ===
  console.log("Exporting constraints...");
  for (const { table_name } of tables) {
    // Primary keys
    const pks = await sql`
      SELECT conname, pg_get_constraintdef(oid, true) AS def
      FROM pg_constraint
      WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = ${table_name} AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND contype = 'p'
    `;
    for (const pk of pks) {
      fullSql += `ALTER TABLE "${table_name}" ADD CONSTRAINT "${pk.conname}" ${pk.def};\n`;
    }

    // Unique constraints
    const uniques = await sql`
      SELECT conname, pg_get_constraintdef(oid, true) AS def
      FROM pg_constraint
      WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = ${table_name} AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND contype = 'u'
    `;
    for (const uq of uniques) {
      fullSql += `ALTER TABLE "${table_name}" ADD CONSTRAINT "${uq.conname}" ${uq.def};\n`;
    }

    // Foreign keys
    const fks = await sql`
      SELECT conname, pg_get_constraintdef(oid, true) AS def
      FROM pg_constraint
      WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = ${table_name} AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND contype = 'f'
    `;
    for (const fk of fks) {
      fullSql += `ALTER TABLE "${table_name}" ADD CONSTRAINT "${fk.conname}" ${fk.def};\n`;
    }

    // Check constraints
    const checks = await sql`
      SELECT conname, pg_get_constraintdef(oid, true) AS def
      FROM pg_constraint
      WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = ${table_name} AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND contype = 'c'
    `;
    for (const chk of checks) {
      fullSql += `ALTER TABLE "${table_name}" ADD CONSTRAINT "${chk.conname}" ${chk.def};\n`;
    }

    if (pks.length || uniques.length || fks.length || checks.length) {
      fullSql += "\n";
    }
  }

  // === INDEXES ===
  console.log("Exporting indexes...");
  const indexes = await sql`
    SELECT indexrelid::regclass AS index_name,
           indrelid::regclass AS table_name,
           pg_get_indexdef(indexrelid) AS def
    FROM pg_index
    WHERE indrelid IN (SELECT oid FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND relkind = 'r')
      AND NOT indisprimary
      AND NOT indisunique
    ORDER BY indrelid::regclass::text, indexrelid::regclass::text
  `;
  for (const idx of indexes) {
    fullSql += `${idx.def};\n`;
  }
  if (indexes.length) fullSql += "\n";

  // === DATA ===
  console.log("Exporting data...");
  for (const { table_name } of tables) {
    const cols = await sql`
      SELECT a.attname AS column_name
      FROM pg_attribute a
      WHERE a.attrelid = (SELECT oid FROM pg_class WHERE relname = ${table_name} AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    `;

    const countRes = await sql.unsafe(`SELECT count(*)::int as cnt FROM "${table_name}"`);
    const count = countRes[0]?.cnt ?? 0;

    if (count === 0) continue;

    console.log(`  ${table_name}: ${count} rows`);

    const colNames = cols.map((c) => `"${c.column_name}"`).join(", ");
    fullSql += `COPY "${table_name}" (${colNames}) FROM STDIN;\n`;

    // Stream rows in batches to avoid memory issues
    const batchSize = 5000;
    for (let offset = 0; offset < count; offset += batchSize) {
      const rows = await sql.unsafe(`SELECT * FROM "${table_name}" ORDER BY 1 LIMIT ${batchSize} OFFSET ${offset}`);
      for (const row of Array.from(rows)) {
        const line = cols.map((c) => formatValue(row[c.column_name])).join("\t");
        fullSql += line + "\n";
      }
    }
    fullSql += "\\.\n\n";
  }

  fs.writeFileSync(path.join(outDir, "dump-v2.sql"), fullSql);
  console.log(`\nDone! Exported to ${path.join(outDir, "dump-v2.sql")}`);
  console.log(`Size: ${(fs.statSync(path.join(outDir, "dump-v2.sql")).size / 1024 / 1024).toFixed(1)} MB`);
  await sql.end();
}

exportDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
